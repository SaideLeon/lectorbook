import { NextRequest, NextResponse } from 'next/server';
import { ANALYST_MODEL, FALLBACK_MODEL, getAIClient } from '@/server/gemini.service';
import { jsonError } from '@/app/api/_utils';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { content, metadata, apiKey } = await req.json();
    const ai = getAIClient(apiKey);

    const fullPrompt = `Você é um especialista em análise de textos e artigos acadêmicos/jornalísticos.

Analise o seguinte artigo:
${content}

Metadados: ${JSON.stringify(metadata || {})}

Sua análise deve incluir:
1. Resumo executivo (3-5 parágrafos)
2. Tese central e argumentos principais
3. Evidências e fontes citadas
4. Pontos fortes e limitações do texto
5. Contexto e relevância do tema
6. Vocabulário-chave e conceitos importantes

IMPORTANTE: Responda em Português (pt-BR). Use Markdown.`;

    try {
      const response = await ai.models.generateContent({ model: ANALYST_MODEL, contents: fullPrompt, config: { tools: [{ googleSearch: {} }] } });
      return NextResponse.json(response);
    } catch (error: any) {
      if (error.status === 429 || error.message?.includes('429')) {
        const response = await ai.models.generateContent({ model: FALLBACK_MODEL, contents: fullPrompt });
        return NextResponse.json(response);
      }
      throw error;
    }
  } catch (error) {
    return jsonError(error);
  }
}
