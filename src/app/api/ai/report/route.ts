import { NextRequest, NextResponse } from 'next/server';
import { ANALYST_MODEL, FALLBACK_MODEL, getAIClient } from '@/server/gemini.service';
import { jsonError } from '@/app/api/_utils';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { article, analysis, apiKey } = await req.json();
    const ai = getAIClient(apiKey);

    const prompt = `Gere um relatório completo em Markdown para exportação sobre o artigo abaixo.

Título: ${article?.title || 'Sem título'}
Conteúdo:
${article?.content || ''}

Análise prévia:
${analysis || ''}

Inclua obrigatoriamente:
1) Resumo final
2) Análise crítica estruturada
3) Citações-chave
4) Perguntas de reflexão
5) Referências e leituras relacionadas

IMPORTANTE: Responda em Português (pt-BR).`;

    try {
      const response = await ai.models.generateContent({ model: ANALYST_MODEL, contents: prompt, config: { tools: [{ googleSearch: {} }] } });
      return NextResponse.json(response);
    } catch (error: any) {
      if (error.status === 429 || error.message?.includes('429')) {
        const response = await ai.models.generateContent({ model: FALLBACK_MODEL, contents: prompt });
        return NextResponse.json(response);
      }
      throw error;
    }
  } catch (error) {
    return jsonError(error);
  }
}
