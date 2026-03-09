/**
 * src/app/api/ai/think/route.ts
 *
 * Rota de chat com streaming.
 * Fallback automático: Gemini → Gemini Flash (429) → Groq (500/503/network errors)
 */

import { NextRequest } from 'next/server';
import { ANALYST_MODEL, FALLBACK_MODEL, getAIClient } from '@/server/gemini.service';
import { groqChatStream } from '@/server/groq.service';
import { jsonError } from '@/app/api/_utils';

type GroqMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export const runtime = 'nodejs';

// ─── Helper: extrai texto de um chunk Gemini ─────────────────────────────────

function getChunkText(chunk: any): string {
  if (!chunk) return '';
  if (typeof chunk.text === 'string') return chunk.text;
  return (
    chunk?.candidates?.[0]?.content?.parts?.find(
      (p: any) => typeof p?.text === 'string',
    )?.text || ''
  );
}

// ─── Códigos de erro que disparam o fallback para o Groq ─────────────────────
//
// 429 → já tem fallback para gemini-flash (mantido)
// 500, 503 → Gemini com problema → vai para Groq
// Erros de rede/timeout → vai para Groq

function shouldFallbackToGroq(error: any): boolean {
  const status = error?.status ?? error?.code;
  if (status === 500 || status === 503) return true;
  // Erros de rede comuns
  const msg: string = error?.message ?? '';
  if (
    msg.includes('fetch failed') ||
    msg.includes('ECONNRESET') ||
    msg.includes('ETIMEDOUT') ||
    msg.includes('network') ||
    msg.includes('503') ||
    msg.includes('500')
  )
    return true;
  return false;
}

// ─── Handler principal ────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const {
      history,
      currentInput,
      context,
      contextFiles = [],
      apiKey,
    } = await req.json();

    const nowInMozambique = new Intl.DateTimeFormat('pt-MZ', {
      dateStyle: 'full',
      timeStyle: 'long',
      timeZone: 'Africa/Maputo',
    }).format(new Date());

    const docsContext = (contextFiles as any[])
      .map((f: any) => `--- ${f.path} ---\n${f.content}\n`)
      .join('\n');

    const systemInstruction = `
      Você é o Tutor de Leitura principal chamado "Lector".
      Seu papel é explicar conteúdos com clareza para o aluno entender.
      Suas especialidades: contabilidade, inglês, direito e economia.
      Vá direto ao conteúdo, sem apresentações ou introduções sobre quem você é.

      Processo de resposta:
      1. Explique de forma didática, em linguagem simples e objetiva.
      2. Use exemplos curtos quando necessário.
      3. Considere que os documentos de referência estão em .md e .txt no GitHub.
      4. Finalize com uma pergunta para confirmar compreensão.
      5. Nunca comece com saudações — inicie diretamente pelo conteúdo.

      IMPORTANTE: responda sempre em Português (pt-BR), tom de docente.
      Referência temporal: hora atual em Moçambique (Africa/Maputo): ${nowInMozambique}.
    `;

    const encoder = new TextEncoder();

    // ── Tenta Gemini primeiro ──────────────────────────────────────────────
    const tryGemini = async (useGeminiStream: any): Promise<ReadableStream | null> => {
      return new ReadableStream({
        async start(controller) {
          const links = new Map<string, { title: string; url: string }>();
          try {
            for await (const chunk of useGeminiStream as any) {
              const text = getChunkText(chunk);
              if (text) {
                controller.enqueue(
                  encoder.encode(`${JSON.stringify({ type: 'chunk', text })}\n`),
                );
              }
              const groundingChunks =
                chunk?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
              for (const g of groundingChunks) {
                const url = g?.web?.uri;
                if (url) links.set(url, { title: g?.web?.title || 'Fonte', url });
              }
            }
            controller.enqueue(
              encoder.encode(
                `${JSON.stringify({ type: 'done', relatedLinks: Array.from(links.values()) })}\n`,
              ),
            );
            controller.close();
          } catch (err) {
            controller.enqueue(
              encoder.encode(
                `${JSON.stringify({
                  type: 'error',
                  message: err instanceof Error ? err.message : 'Erro no streaming Gemini.',
                })}\n`,
              ),
            );
            controller.close();
          }
        },
      });
    };

    // ── Tenta Groq como fallback ──────────────────────────────────────────
    const tryGroq = (): ReadableStream => {
      // Converte o histórico para o formato Groq (OpenAI-compatible)
      const groqMessages: GroqMessage[] = [
        {
          role: 'user',
          content: `Contexto geral do repositório:\n${context}`,
        },
        {
          role: 'user',
          content: `Documentos .md/.txt disponíveis:\n${docsContext || 'Nenhum disponível.'}`,
        },
        ...(history || []).map((h: any) => ({
          role: (h.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
          content: h.content as string,
        })),
        { role: 'user' as const, content: currentInput as string },
      ];

      return new ReadableStream({
        start(controller) {
          groqChatStream({
            messages: groqMessages,
            systemInstruction,
            contextFiles,
            onChunk(text) {
              controller.enqueue(
                encoder.encode(`${JSON.stringify({ type: 'chunk', text })}\n`),
              );
            },
            onDone() {
              // Groq não retorna grounding links — envia done sem links
              controller.enqueue(
                encoder.encode(
                  `${JSON.stringify({ type: 'done', relatedLinks: [] })}\n`,
                ),
              );
              controller.close();
            },
            onError(err) {
              controller.enqueue(
                encoder.encode(
                  `${JSON.stringify({ type: 'error', message: err.message })}\n`,
                ),
              );
              controller.close();
            },
          });
        },
      });
    };

    const streamHeaders = {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    };

    // ── 1. Tenta ANALYST_MODEL (Gemini Pro) ───────────────────────────────
    const ai = getAIClient(apiKey);

    const contents = [
      { role: 'user', parts: [{ text: `Contexto geral: ${context}` }] },
      {
        role: 'user',
        parts: [
          {
            text: `Conteúdo automático dos arquivos .md/.txt:\n${docsContext || 'Nenhum disponível.'}`,
          },
        ],
      },
      ...(history || []).map((h: any) => ({
        role: h.role === 'user' ? 'user' : 'model',
        parts: [{ text: h.content }],
      })),
      { role: 'user', parts: [{ text: currentInput }] },
    ];

    const streamConfig = { systemInstruction, tools: [{ googleSearch: {} }] };

    try {
      const geminiStream = await ai.models.generateContentStream({
        model: ANALYST_MODEL,
        contents,
        config: streamConfig,
      });
      return new Response(await tryGemini(geminiStream), { headers: streamHeaders });
    } catch (primaryError: any) {
      // ── 2. 429 → tenta Gemini Flash ────────────────────────────────────
      if (primaryError?.status === 429 || primaryError?.message?.includes('429')) {
        try {
          const fallbackStream = await ai.models.generateContentStream({
            model: FALLBACK_MODEL,
            contents,
            config: { systemInstruction },
          });
          return new Response(await tryGemini(fallbackStream), { headers: streamHeaders });
        } catch (flashError: any) {
          // Flash também falhou — vai para Groq
          if (shouldFallbackToGroq(flashError)) {
            return new Response(tryGroq(), { headers: streamHeaders });
          }
          throw flashError;
        }
      }

      // ── 3. 500 / 503 / rede → vai direto para Groq ─────────────────────
      if (shouldFallbackToGroq(primaryError)) {
        return new Response(tryGroq(), { headers: streamHeaders });
      }

      throw primaryError;
    }
  } catch (error) {
    return jsonError(error);
  }
}
