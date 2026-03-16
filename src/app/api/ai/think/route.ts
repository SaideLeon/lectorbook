/**
 * src/app/api/ai/think/route.ts
 *
 * Rota de chat com streaming.
 * Modelo principal: Groq.
 * Recuperação de contexto: ranking lexical local (sem embeddings).
 */

import { NextRequest } from 'next/server';
import { groqChatStream } from '@/server/groq.service';
import { jsonError } from '@/app/api/_utils';
import { buildRelevantContext, createSearchQuery } from '@/server/semantic-search';

type GroqMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export const runtime = 'nodejs';

// ─── Handler principal ────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const {
      history,
      currentInput,
      context,
      contextFiles = [],
    } = await req.json();

    const nowInMozambique = new Intl.DateTimeFormat('pt-MZ', {
      dateStyle: 'full',
      timeStyle: 'long',
      timeZone: 'Africa/Maputo',
    }).format(new Date());

    const retrievalQuery = createSearchQuery(currentInput || '', history || []);

    let docsContext = 'Nenhum trecho relevante encontrado para a pergunta.';
    let selectedChunksCount = 0;
    const retrievalWarnings: string[] = [];

    try {
      const retrieval = await buildRelevantContext({
        query: retrievalQuery,
        contextFiles: contextFiles || [],
        maxChunks: 6,
      });
      docsContext = retrieval.renderedContext;
      selectedChunksCount = retrieval.selectedChunks.length;
      retrievalWarnings.push(...retrieval.warnings);
    } catch (retrievalError) {
      const retrievalMessage = retrievalError instanceof Error ? retrievalError.message : String(retrievalError);
      console.warn('[think] Falha na recuperação lexical; aplicando fallback mínimo.', retrievalMessage);
      retrievalWarnings.push(`Falha na recuperação lexical: ${retrievalMessage}`);
      const lexicalFallback = await buildRelevantContext({
        query: retrievalQuery,
        contextFiles: contextFiles || [],
        maxChunks: 6,
      });
      docsContext = lexicalFallback.renderedContext;
      selectedChunksCount = lexicalFallback.selectedChunks.length;
    }

    const compactHistory = (history || [])
      .slice(-8)
      .map((h: any) => ({
        role: h.role,
        content:
          typeof h.content === 'string' && h.content.length > 1600
            ? `${h.content.slice(0, 1600)}\n\n[... histórico truncado para reduzir tokens ...]`
            : (h.content || ''),
      }));

    const compactDocsContext = docsContext.length > 9000
      ? `${docsContext.slice(0, 9000)}\n\n[... contexto recuperado truncado para respeitar limite de tokens ...]`
      : docsContext;

    const systemInstruction = `
      Você é o Tutor de Leitura principal chamado "Lector".
      Seu papel é explicar conteúdos com clareza para o aluno entender.
      Suas especialidades: contabilidade, inglês, direito e economia.
      Vá direto ao conteúdo, sem apresentações ou introduções sobre quem você é.

      Processo de resposta:
      1. Explique de forma didática, em linguagem simples e objetiva.
      2. Use exemplos curtos quando necessário.
      3. Considere apenas o contexto recuperado dos arquivos selecionados do GitHub.
      4. Finalize com uma pergunta para confirmar compreensão.
      5. Nunca comece com saudações — inicie diretamente pelo conteúdo.

      IMPORTANTE: responda sempre em Português (pt-BR), tom de docente.
      Se o contexto recuperado não trouxer base suficiente, informe explicitamente a limitação antes de responder.
      Referência temporal: hora atual em Moçambique (Africa/Maputo): ${nowInMozambique}.
    `;

    const encoder = new TextEncoder();

    const streamFromGroq = (): ReadableStream => {
      // Converte o histórico para o formato Groq (OpenAI-compatible)
      const groqMessages: GroqMessage[] = [
        {
          role: 'user',
          content: `Contexto geral do repositório:\n${context}`,
        },
        {
          role: 'user',
          content: `Trechos recuperados por busca lexical:\n${compactDocsContext || 'Nenhum disponível.'}\n\nTotal de trechos selecionados: ${selectedChunksCount}.`,
        },
        ...compactHistory.map((h: any) => ({
          role: (h.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
          content: h.content as string,
        })),
        { role: 'user' as const, content: currentInput as string },
      ];

      return new ReadableStream({
        start(controller) {
          for (const warning of retrievalWarnings) {
            controller.enqueue(
              encoder.encode(
                `${JSON.stringify({ type: 'log', level: 'warning', message: warning })}\n`,
              ),
            );
          }

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

    return new Response(streamFromGroq(), { headers: streamHeaders });
  } catch (error) {
    return jsonError(error);
  }
}
