import { NextRequest, NextResponse } from 'next/server';
import { AppError, jsonError } from '@/app/api/_utils';
import { ANALYST_MODEL, FALLBACK_MODEL, getAIClient } from '@/server/gemini.service';

export const runtime = 'nodejs';

interface WavConversionOptions {
  numChannels: number;
  sampleRate: number;
  bitsPerSample: number;
}

function extractText(response: any): string {
  if (typeof response?.text === 'string' && response.text.trim()) return response.text;
  return response?.candidates?.[0]?.content?.parts?.find((part: any) => typeof part?.text === 'string')?.text || '';
}

function parseMimeType(mimeType: string): WavConversionOptions {
  const [fileType, ...params] = mimeType.split(';').map((part) => part.trim());
  const [, format = 'L16'] = fileType.split('/');

  const options: WavConversionOptions = {
    numChannels: 1,
    sampleRate: 24000,
    bitsPerSample: 16,
  };

  if (format.startsWith('L')) {
    const bits = Number.parseInt(format.slice(1), 10);
    if (!Number.isNaN(bits)) options.bitsPerSample = bits;
  }

  for (const param of params) {
    const [key, value] = param.split('=').map((part) => part.trim());
    if (key === 'rate') {
      const rate = Number.parseInt(value, 10);
      if (!Number.isNaN(rate)) options.sampleRate = rate;
    }
  }

  return options;
}

function createWavHeader(dataLength: number, options: WavConversionOptions) {
  const { numChannels, sampleRate, bitsPerSample } = options;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const buffer = Buffer.alloc(44);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataLength, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataLength, 40);

  return buffer;
}

function convertPcmToWav(pcmData: Buffer, mimeType: string) {
  const options = parseMimeType(mimeType);
  const wavHeader = createWavHeader(pcmData.length, options);
  return Buffer.concat([wavHeader, pcmData]);
}

export async function POST(req: NextRequest) {
  try {
    const { history = [], currentInput, context, contextFiles = [], apiKey } = await req.json();

    if (!currentInput || typeof currentInput !== 'string') {
      throw new AppError('Mensagem inválida para conversa ao vivo.', 400);
    }

    const ai = getAIClient(apiKey);
    const docsContext = contextFiles
      .map((file: { path: string; content: string }) => `--- ${file.path} ---\n${file.content}\n`)
      .join('\n');

    const nowInMozambique = new Intl.DateTimeFormat('pt-MZ', {
      dateStyle: 'full',
      timeStyle: 'long',
      timeZone: 'Africa/Maputo',
    }).format(new Date());

    const systemInstruction = `
      Você é o Tutor de Leitura principal chamado "Lector".
      Seu papel é explicar conteúdos com clareza para o aluno entender, em tom docente.
      Vá direto ao conteúdo solicitado, sem apresentações sobre quem você é.

      Processo de resposta:
      1. Explique de forma didática e objetiva.
      2. Use exemplos curtos quando necessário.
      3. Faça pergunta de confirmação ao final.
      4. Use os materiais do repositório (.md/.txt) como referência principal.
      5. Em qualquer pedido temporal, use explicitamente o fuso de Moçambique.

      Referência temporal obrigatória: ${nowInMozambique}.
      Responda sempre em Português (pt-BR).
    `;

    const contents = [
      { role: 'user', parts: [{ text: `Contexto geral: ${context || 'Nenhum contexto disponível.'}` }] },
      { role: 'user', parts: [{ text: `Conteúdo dos arquivos .md/.txt:\n${docsContext || 'Nenhum arquivo .md/.txt disponível.'}` }] },
      ...(history || []).map((item: { role: string; content: string }) => ({
        role: item.role === 'user' ? 'user' : 'model',
        parts: [{ text: item.content }],
      })),
      { role: 'user', parts: [{ text: currentInput }] },
    ];

    const textResponse = await (async () => {
      try {
        return await ai.models.generateContent({
          model: ANALYST_MODEL,
          contents,
          config: { systemInstruction },
        });
      } catch (error: any) {
        if (error?.status === 429 || error?.message?.includes('429')) {
          return ai.models.generateContent({
            model: FALLBACK_MODEL,
            contents,
            config: { systemInstruction },
          });
        }
        throw error;
      }
    })();

    const answerText = extractText(textResponse);
    if (!answerText.trim()) {
      throw new AppError('A IA não retornou texto para a conversa ao vivo.', 502);
    }

    const ttsStream = await ai.models.generateContentStream({
      model: 'gemini-2.5-flash-preview-tts',
      config: {
        temperature: 1,
        responseModalities: ['audio'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: 'Zephyr',
            },
          },
        },
      },
      contents: [{ role: 'user', parts: [{ text: `Leia em voz alta em português do Brasil com tom caloroso: ${answerText}` }] }],
    });

    const chunks: Buffer[] = [];
    let detectedMimeType = 'audio/wav';

    for await (const chunk of ttsStream as any) {
      const inlineData = chunk?.candidates?.[0]?.content?.parts?.[0]?.inlineData;
      if (!inlineData?.data) continue;
      detectedMimeType = inlineData.mimeType || detectedMimeType;
      chunks.push(Buffer.from(inlineData.data, 'base64'));
    }

    if (chunks.length === 0) {
      throw new AppError('A IA não retornou áudio para a conversa ao vivo.', 502);
    }

    let audioBuffer = Buffer.concat(chunks);
    let mimeType = detectedMimeType;

    if (mimeType.includes('audio/L')) {
      audioBuffer = convertPcmToWav(audioBuffer, mimeType);
      mimeType = 'audio/wav';
    }

    return NextResponse.json({
      text: answerText,
      audioBase64: audioBuffer.toString('base64'),
      mimeType,
    });
  } catch (error) {
    return jsonError(error);
  }
}
