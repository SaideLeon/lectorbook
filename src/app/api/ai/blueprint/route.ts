import { NextRequest, NextResponse } from 'next/server';
import { ANALYST_MODEL, FALLBACK_MODEL, getAIClient } from '@/server/gemini.service';
import { jsonError } from '@/app/api/_utils';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { contextFiles, context, apiKey } = await req.json();
    const ai = getAIClient(apiKey);
    const fileContext = (contextFiles || []).map((f: any) => `--- ${f.path} ---\n${f.content}\n`).join('\n');

    const prompt = `
      You are an elite Software Architect and Technical Lead.
      Generate a comprehensive TECHNICAL BLUEPRINT for this codebase.

      Input Context:
      ${context}

      Codebase:
      ${fileContext}

      Include, with explicit details:
      1) Project Overview & Architecture
      2) Tech Stack & Dependencies
      3) Component Analysis
      4) Refactoring Strategy (step-by-step)
      5) Implementation Guidelines
      6) Explicit tasks for an AI coding assistant
      7) Risk analysis and mitigation

      IMPORTANT: You MUST respond in Portuguese (pt-BR) and Markdown.
    `;

    try {
      const response = await ai.models.generateContent({
        model: ANALYST_MODEL,
        contents: prompt,
        config: { tools: [{ googleSearch: {} }] },
      });
      return NextResponse.json(response);
    } catch (error: any) {
      if (error.status === 429 || error.message?.includes('429')) {
        const response = await ai.models.generateContent({
          model: FALLBACK_MODEL,
          contents: prompt,
        });
        return NextResponse.json(response);
      }
      throw error;
    }
  } catch (error) {
    return jsonError(error);
  }
}
