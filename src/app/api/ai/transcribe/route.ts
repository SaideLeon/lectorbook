import { NextRequest, NextResponse } from 'next/server';
import { AppError, jsonError } from '@/app/api/_utils';

export const runtime = 'nodejs';

const rawGroqKey = process.env.GROQ_API_KEY ?? '';
const groqApiKey = rawGroqKey.split(',').map((k) => k.trim()).find((k) => k.length > 0);

export async function POST(req: NextRequest) {
  try {
    if (!groqApiKey) {
      throw new AppError('GROQ_API_KEY não configurada no ambiente.', 500);
    }

    const formData = await req.formData();
    const audio = formData.get('audio');

    if (!(audio instanceof Blob)) {
      throw new AppError('Arquivo de áudio inválido.', 400);
    }

    const fileName = audio instanceof File ? (audio.name || 'audio.webm') : 'audio.webm';

    const payload = new FormData();
    payload.append('file', audio, fileName);
    payload.append('model', 'whisper-large-v3-turbo');
    payload.append('temperature', '0');
    payload.append('language', 'pt');
    payload.append('response_format', 'verbose_json');

    const transcriptionResponse = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${groqApiKey}`,
      },
      body: payload,
    });

    if (!transcriptionResponse.ok) {
      const errorBody = await transcriptionResponse.text();
      throw new AppError(`Falha ao transcrever áudio no Groq: ${errorBody || transcriptionResponse.statusText}`, transcriptionResponse.status);
    }

    const transcription = await transcriptionResponse.json() as { text?: string };
    return NextResponse.json({ text: transcription.text || '' });
  } catch (error) {
    return jsonError(error);
  }
}
