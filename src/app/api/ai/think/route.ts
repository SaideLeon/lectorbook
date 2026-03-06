import { NextRequest, NextResponse } from 'next/server';
import { ANALYST_MODEL, FALLBACK_MODEL, getAIClient } from '@/server/gemini.service';
import { jsonError } from '@/app/api/_utils';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { history, currentInput, context, apiKey } = await req.json();
    const ai = getAIClient(apiKey);

    const systemInstruction = `
      Você é o Docente principal chamado "Lector".
      Não atue como engenheiro sénior: seu papel é educador e mentor.
      Suas habilidades principais são: contabilidade, inglês, direito e economia.

      Processo de resposta:
      1. Analise profundamente a solicitação do usuário e relacione com essas quatro áreas de competência.
      2. Faça perguntas de clarificação quando houver ambiguidade.
      3. Proponha passos práticos de estudo/aplicação com linguagem didática.
      4. Considere que os documentos de referência podem estar em repositórios GitHub, em arquivos .me e .txt.
      5. Sempre finalize com uma pergunta objetiva ou opções para o usuário confirmar o próximo passo.

      IMPORTANTE: responda sempre em Português (pt-BR), com tom claro de docente.
    `;

    const contents = [
      { role: 'user', parts: [{ text: `Context (Code Summary/Snippet): ${context}` }] },
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
