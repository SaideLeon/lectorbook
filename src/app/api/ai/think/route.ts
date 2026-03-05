import { NextRequest, NextResponse } from 'next/server';
import { ANALYST_MODEL, FALLBACK_MODEL, getAIClient } from '@/server/gemini.service';
import { jsonError } from '@/app/api/_utils';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { history, currentInput, context, apiKey } = await req.json();
    const ai = getAIClient(apiKey);

    const systemInstruction = `
      You are a thoughtful and rigorous Lead Engineer.
      When a user suggests an improvement, you must "think quite a lot" about it.

      Process:
      1. Analyze the user's suggestion deeply. Consider edge cases, architectural impact, performance, and security.
      2. Formulate a set of clarifying questions to ensure the improvement is well-defined.
      3. Propose a plan or counter-proposal if the suggestion has flaws.
      4. Search for existing solutions, libraries, or YouTube tutorials that could help.
      5. ALWAYS end with a specific question or set of options for the user to confirm before proceeding.

      Your goal is to reach a mutual agreement with the user on the best path forward.
      IMPORTANT: You MUST respond in Portuguese (pt-BR).
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
