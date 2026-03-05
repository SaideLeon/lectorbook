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
      You are an expert Senior Software Engineer and Code Analyst.
      Here is the code from a GitHub repository:
      ${fileContext}
      ${prompt ? `User Request: ${prompt}` : 'Please perform a comprehensive analysis of this codebase.'}

      Your task:
      1. Summarize the purpose of the project.
      2. Identify the tech stack.
      3. List 3-5 major strengths.
      4. List 3-5 areas for improvement (bugs, security risks, performance, code quality).
      5. If the user asked a specific question, answer it in detail.

      IMPORTANT: You MUST respond in Portuguese (pt-BR).
      Format your response in Markdown.
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
