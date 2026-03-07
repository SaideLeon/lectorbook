import { NextRequest, NextResponse } from 'next/server';
import { ANALYST_MODEL, FALLBACK_MODEL, getAIClient } from '@/server/gemini.service';
import { jsonError } from '@/app/api/_utils';

export const runtime = 'nodejs';

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

    try {
      const response = await ai.models.generateContent({
        model: ANALYST_MODEL,
        contents,
        config: { systemInstruction, tools: [{ googleSearch: {} }] },
      });
      return NextResponse.json(response);
    } catch (error: any) {
      if (error.status === 429 || error.message?.includes('429')) {
        const response = await ai.models.generateContent({
          model: FALLBACK_MODEL,
          contents,
          config: { systemInstruction },
        });
        return NextResponse.json(response);
      }
      throw error;
    }
  } catch (error) {
    return jsonError(error);
  }
}
