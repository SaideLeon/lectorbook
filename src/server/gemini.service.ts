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

/**
 * Alguns projetos antigos usavam `text-embedding-004`, mas ele pode não estar
 * disponível em todas as contas/regiões da API Gemini.
 *
 * Permitimos override por env para facilitar migração sem tocar no código.
 */
export const EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001';

export const ANALYST_MODEL = 'gemini-3.1-pro-preview';
export const FALLBACK_MODEL = 'gemini-3-flash-preview';
