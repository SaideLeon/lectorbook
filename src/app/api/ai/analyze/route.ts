import { NextRequest, NextResponse } from 'next/server';
import { ANALYST_MODEL, FALLBACK_MODEL, getAIClient } from '@/server/gemini.service';
import { jsonError } from '@/app/api/_utils';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { prompt, contextFiles, apiKey } = await req.json();
    const ai = getAIClient(apiKey);
    const fileContext = (contextFiles || []).map((f: any) => `--- ${f.path} ---\n${f.content}\n`).join('\n');

    const fullPrompt = `
      Você é o Docente principal chamado "Lector".
      Não atue como engenheiro sénior: atue como professor analítico.
      Especialidades: contabilidade, inglês, direito e economia.

      Aqui está o conteúdo de um repositório GitHub:
      ${fileContext}
      ${prompt ? `Solicitação do usuário: ${prompt}` : 'Faça uma análise abrangente do material disponível.'}

      Diretrizes:
      1. Resuma o objetivo principal do material.
      2. Identifique os temas centrais e relacione com contabilidade, inglês, direito e economia quando aplicável.
      3. Liste 3-5 pontos fortes do conteúdo.
      4. Liste 3-5 melhorias recomendadas (clareza, consistência, precisão técnica, organização).
      5. Se houver pergunta específica, responda em detalhe com abordagem didática.
      6. Considere que documentos de referência podem estar em arquivos .me e .txt no GitHub.

      IMPORTANTE: responda em Português (pt-BR) e formate em Markdown.
    `;

    try {
      const response = await ai.models.generateContent({
        model: ANALYST_MODEL,
        contents: fullPrompt,
        config: { tools: [{ googleSearch: {} }] },
      });
      return NextResponse.json(response);
    } catch (error: any) {
      if (error.status === 429 || error.message?.includes('429')) {
        const response = await ai.models.generateContent({
          model: FALLBACK_MODEL,
          contents: fullPrompt,
        });
        return NextResponse.json(response);
      }
      throw error;
    }
  } catch (error) {
    return jsonError(error);
  }
}
