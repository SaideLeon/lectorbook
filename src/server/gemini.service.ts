import { GoogleGenAI } from '@google/genai';

let aiClient: GoogleGenAI | null = null;

export function getAIClient(apiKey?: string) {
  if (apiKey) return new GoogleGenAI({ apiKey });

  if (!aiClient) {
    const envKey = process.env.GEMINI_API_KEY;
    if (!envKey) throw new Error('GEMINI_API_KEY is not set');
    aiClient = new GoogleGenAI({ apiKey: envKey });
  }
  return aiClient;
}

export const ANALYST_MODEL = 'gemini-3.1-pro-preview';
export const FALLBACK_MODEL = 'gemini-3-flash-preview';
