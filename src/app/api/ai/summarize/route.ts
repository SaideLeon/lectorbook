import { NextRequest, NextResponse } from 'next/server';
import { ANALYST_MODEL, FALLBACK_MODEL, getAIClient } from '@/server/gemini.service';
import { jsonError } from '@/app/api/_utils';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { content, apiKey } = await req.json();
    const ai = getAIClient(apiKey);
    const prompt = `Resuma o texto abaixo em 5 bullets executivos em Português (pt-BR):\n\n${content}`;
    try {
      const response = await ai.models.generateContent({ model: ANALYST_MODEL, contents: prompt });
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
