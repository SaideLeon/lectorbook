import { NextRequest } from 'next/server';
import { ANALYST_MODEL, FALLBACK_MODEL, getAIClient } from '@/server/gemini.service';
import { jsonError } from '@/app/api/_utils';

export const runtime = 'nodejs';

function getChunkText(chunk: any): string {
  if (!chunk) return '';

  if (typeof chunk.text === 'string') return chunk.text;

  const partText = chunk?.candidates?.[0]?.content?.parts?.find((p: any) => typeof p?.text === 'string')?.text;
  return partText || '';
}

export async function POST(req: NextRequest) {
  try {
    const { history, currentInput, context, contextFiles = [], apiKey } = await req.json();
    const ai = getAIClient(apiKey);

    const docsContext = (contextFiles || [])
      .map((f: any) => `--- ${f.path} ---\n${f.content}\n`)
      .join('\n');

    const systemInstruction = `
      Você é o Tutor de Leitura principal chamado "Lector".
      Seu papel é explicar conteúdos com clareza para o aluno entender, e não atuar como analista.
      Suas habilidades principais são: contabilidade, inglês, direito e economia.

      Processo de resposta:
      1. Explique o conteúdo de forma didática, em linguagem simples e objetiva.
      2. Use exemplos curtos quando necessário para facilitar a compreensão.
      3. Faça perguntas de clarificação quando houver ambiguidade.
      4. Considere que os documentos de referência estarão em repositórios GitHub, principalmente em arquivos .md e .txt.
      5. Sempre finalize com uma pergunta objetiva para confirmar se o aluno entendeu ou qual tópico deseja aprofundar.

      IMPORTANTE: responda sempre em Português (pt-BR), com tom de docente explicador.
    `;

    const contents = [
      { role: 'user', parts: [{ text: `Contexto geral: ${context}` }] },
      { role: 'user', parts: [{ text: `Conteúdo automático dos arquivos .md/.txt do repositório:\n${docsContext || 'Nenhum arquivo .md/.txt disponível.'}` }] },
      ...(history || []).map((h: any) => ({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: h.content }] })),
      { role: 'user', parts: [{ text: currentInput }] },
    ];

    const streamConfig = { systemInstruction, tools: [{ googleSearch: {} }] };

    const responseStream = await (async () => {
      try {
        return await ai.models.generateContentStream({
          model: ANALYST_MODEL,
          contents,
          config: streamConfig,
        });
      } catch (error: any) {
        if (error?.status === 429 || error?.message?.includes('429')) {
          return ai.models.generateContentStream({
            model: FALLBACK_MODEL,
            contents,
            config: { systemInstruction },
          });
        }
        throw error;
      }
    })();

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const links = new Map<string, { title: string; url: string }>();

        try {
          for await (const chunk of responseStream as any) {
            const text = getChunkText(chunk);

            if (text) {
              controller.enqueue(encoder.encode(`${JSON.stringify({ type: 'chunk', text })}\n`));
            }

            const groundingChunks = chunk?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
            for (const grounding of groundingChunks) {
              const url = grounding?.web?.uri;
              if (!url) continue;
              links.set(url, {
                title: grounding?.web?.title || 'Fonte',
                url,
              });
            }
          }

          controller.enqueue(
            encoder.encode(
              `${JSON.stringify({ type: 'done', relatedLinks: Array.from(links.values()) })}\n`
            )
          );
          controller.close();
        } catch (error) {
          controller.enqueue(
            encoder.encode(
              `${JSON.stringify({ type: 'error', message: error instanceof Error ? error.message : 'Erro desconhecido ao processar resposta.' })}\n`
            )
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
