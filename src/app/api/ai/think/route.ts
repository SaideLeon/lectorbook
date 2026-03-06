import { NextRequest, NextResponse } from 'next/server';
import { ANALYST_MODEL, FALLBACK_MODEL, getAIClient } from '@/server/gemini.service';
import { jsonError } from '@/app/api/_utils';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { history, currentInput, context, apiKey } = await req.json();
    const ai = getAIClient(apiKey);

    const systemInstruction = `Você é um tutor intelectual profundo especializado em discussão de textos.

Ao responder perguntas sobre o artigo:
1. Cite trechos específicos quando relevante
2. Conecte ideias com contexto mais amplo
3. Sugira leituras relacionadas quando pertinente
4. Questione premissas quando necessário
5. Busque fontes externas para enriquecer a discussão

IMPORTANTE: Responda em Português (pt-BR).`;

    const contents = [
      { role: 'user', parts: [{ text: `Contexto do artigo: ${context}` }] },
      ...(history || []).map((h: any) => ({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: h.content }] })),
      { role: 'user', parts: [{ text: currentInput }] }
    ];

    try {
      const response = await ai.models.generateContent({ model: ANALYST_MODEL, contents, config: { systemInstruction, tools: [{ googleSearch: {} }] } });
      return NextResponse.json(response);
    } catch (error: any) {
      if (error.status === 429 || error.message?.includes('429')) {
        const response = await ai.models.generateContent({ model: FALLBACK_MODEL, contents, config: { systemInstruction } });
        return NextResponse.json(response);
      }
      throw error;
    }
  } catch (error) {
    return jsonError(error);
  }
}
