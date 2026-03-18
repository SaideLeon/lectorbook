'use client';

import { useState, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { useAudioInput, INPUT_SAMPLE_RATE } from './useAudioInput';
import { useAudioOutput } from './useAudioOutput';

export type LiveSessionStatus = 'idle' | 'connecting' | 'active' | 'error';

interface UseLiveVoiceProps {
  contextFiles: { path: string; content: string }[];
  apiKey?: string;
}

const LIVE_MODEL = 'gemini-2.5-flash-native-audio-preview-12-2025';

/** Builds the Lector tutor system instruction using selected .md/.txt files */
function buildSystemInstruction(files: { path: string; content: string }[]): string {
  const nowMZ = new Intl.DateTimeFormat('pt-MZ', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Africa/Maputo',
  }).format(new Date());

  const hasContext = files.length > 0;
  const contextBlock = hasContext
    ? `\n\nMATERIAL DE ESTUDO (use exclusivamente este conteúdo para responder):\n\n${files
        .map(f => `=== ${f.path} ===\n${f.content.slice(0, 1000000)}`)
        .join('\n\n---\n\n')}`
    : '';

  return `Você é o Tutor de Leitura principal chamado "Lector", especializado em contabilidade, inglês, direito e economia.
Você está em uma conversa de voz ao vivo com o aluno.

Regras de comportamento:
1. Responda em Português (pt-BR), de forma didática, clara e objetiva.
2. Adapte o nível de linguagem ao aluno — simplifique conceitos complexos com exemplos práticos.
3. Nunca comece com saudações ou apresentações — vá direto ao conteúdo.
4. Quando o aluno perguntar algo, responda de forma concisa para voz (evite listas longas ou código).
5. Ao terminar uma explicação, faça uma pergunta curta para confirmar se o aluno compreendeu.
${hasContext ? '6. Baseie suas respostas EXCLUSIVAMENTE no material de estudo fornecido abaixo. Se perguntarem algo fora do material, informe gentilmente.' : '6. Use seu conhecimento geral sobre contabilidade, direito, inglês e economia.'}

Referência temporal: ${nowMZ} (Africa/Maputo).
${contextBlock}`;
}

export function useLiveVoice({ contextFiles, apiKey }: UseLiveVoiceProps) {
  const [status, setStatus]           = useState<LiveSessionStatus>('idle');
  const [isActive, setIsActive]       = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [transcription, setTranscription] = useState<{ user?: string; model?: string }>({});

  const { startInput, stopInput, volume, isMuted, toggleMute } = useAudioInput();
  const { startOutput, stopOutput, enqueueAudio, clearQueue }   = useAudioOutput();

  const sessionRef = useRef<any>(null);

  const stopSession = useCallback(() => {
    setIsActive(false);
    setStatus('idle');
    setTranscription({});
    stopInput();
    stopOutput();
    if (sessionRef.current) {
      try { sessionRef.current.close(); } catch { /* ignore */ }
      sessionRef.current = null;
    }
  }, [stopInput, stopOutput]);

  const startSession = useCallback(async () => {
    setError(null);
    setStatus('connecting');

    const resolvedKey = apiKey ?? (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_GEMINI_API_KEY : undefined);

    if (!resolvedKey) {
      setError('Nenhuma API Key do Gemini encontrada. Carregue uma chave nas configurações (⚙).');
      setStatus('error');
      return;
    }

    try {
      const ai = new GoogleGenAI({ apiKey: resolvedKey });
      const systemInstruction = buildSystemInstruction(contextFiles);

      const session = await ai.live.connect({
        model: LIVE_MODEL,
        callbacks: {
          onopen: () => {
            setStatus('active');
            setIsActive(true);
            startOutput();
            startInput((base64) => {
              session.sendRealtimeInput({
                media: { data: base64, mimeType: `audio/pcm;rate=${INPUT_SAMPLE_RATE}` },
              });
            });
          },
          onmessage: (message: LiveServerMessage) => {
            // Audio chunks
            const parts = message.serverContent?.modelTurn?.parts ?? [];
            for (const part of parts) {
              if (part.inlineData?.data) enqueueAudio(part.inlineData.data);
            }
            // Transcriptions
            if (message.serverContent?.inputTranscription) {
              setTranscription(prev => ({ ...prev, user: message.serverContent?.inputTranscription?.text }));
            }
            if (message.serverContent?.outputTranscription) {
              setTranscription(prev => ({ ...prev, model: message.serverContent?.outputTranscription?.text }));
            }
            // Interruption
            if (message.serverContent?.interrupted) {
              clearQueue();
              setTranscription(prev => ({ user: prev.user })); // keep last user turn
            }
          },
          onclose: () => stopSession(),
          onerror: (e: unknown) => {
            console.error('[LiveVoice]', e);
            const msg = e instanceof Error ? e.message : 'Erro na conexão com Gemini Live.';
            setError(msg);
            setStatus('error');
            stopSession();
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
          systemInstruction,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
      });

      sessionRef.current = session;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao iniciar sessão ao vivo.';
      setError(msg);
      setStatus('error');
    }
  }, [apiKey, contextFiles, startInput, startOutput, enqueueAudio, clearQueue, stopSession]);

  const toggleSession = useCallback(() => {
    if (isActive) stopSession();
    else startSession();
  }, [isActive, startSession, stopSession]);

  return {
    isActive,
    status,
    error,
    transcription,
    volume,
    isMuted,
    toggleMute,
    toggleSession,
    stopSession,
  };
}
