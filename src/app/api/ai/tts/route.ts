import { NextRequest, NextResponse } from 'next/server';
import { AppError, jsonError } from '@/app/api/_utils';
import { getAIClient } from '@/server/gemini.service';

export const runtime = 'nodejs';

interface WavConversionOptions {
  numChannels: number;
  sampleRate: number;
  bitsPerSample: number;
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
    const { text, apiKey } = await req.json();

    if (!text || typeof text !== 'string' || !text.trim()) {
      throw new AppError('Texto inválido para sintetizar áudio.', 400);
    }

    const ai = getAIClient(apiKey);

    const responseStream = await ai.models.generateContentStream({
      model: 'gemini-2.5-flash-preview-tts',
      config: {
        temperature: 1,
        responseModalities: ['audio'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: 'Puck',
            },
          },
        },
      },
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Leia em voz alta com tom caloroso e amigável, em português do Brasil: ${text}`,
            },
          ],
        },
      ],
    });

    const chunks: Buffer[] = [];
    let detectedMimeType = 'audio/wav';

    for await (const chunk of responseStream as any) {
      const inlineData = chunk?.candidates?.[0]?.content?.parts?.[0]?.inlineData;
      if (!inlineData?.data) continue;
      detectedMimeType = inlineData.mimeType || detectedMimeType;
      chunks.push(Buffer.from(inlineData.data, 'base64'));
    }

    if (chunks.length === 0) {
      throw new AppError('A IA não retornou áudio para o texto informado.', 502);
    }

    let audioBuffer = Buffer.concat(chunks);
    let mimeType = detectedMimeType;

    if (mimeType.includes('audio/L')) {
      audioBuffer = convertPcmToWav(audioBuffer, mimeType);
      mimeType = 'audio/wav';
    }

    return NextResponse.json({
      audioBase64: audioBuffer.toString('base64'),
      mimeType,
    });
  } catch (error) {
    return jsonError(error);
  }
}
