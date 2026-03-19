'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { useAudioInput, INPUT_SAMPLE_RATE } from './useAudioInput';
import { useAudioOutput } from './useAudioOutput';

export type LiveSessionStatus = 'idle' | 'connecting' | 'active' | 'error';

export interface TranscriptTurn {
  id: string;
  role: 'user' | 'model';
  text: string;
  interrupted?: boolean;
  highlightIndex: number; // índice da palavra atual; -1 = highlight concluído/inactivo
}

const MAX_TURNS = 30;

// Velocidade estimada da voz sintética do Gemini (~158 palavras/min)
const MS_PER_WORD = 380;

interface UseLiveVoiceProps {
  contextFiles: { path: string; content: string }[];
  apiKey?: string;
}

const LIVE_MODEL = 'gemini-2.5-flash-native-audio-preview-12-2025';

/** Constrói o system instruction do tutor com contexto dos ficheiros seleccionados */
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
${hasContext
  ? '6. Baseie suas respostas EXCLUSIVAMENTE no material de estudo fornecido abaixo. Se perguntarem algo fora do material, informe gentilmente.'
  : '6. Use seu conhecimento geral sobre contabilidade, direito, inglês e economia.'}

Referência temporal: ${nowMZ} (Africa/Maputo).
${contextBlock}`;
}

export function useLiveVoice({ contextFiles, apiKey }: UseLiveVoiceProps) {
  const [status, setStatus]     = useState<LiveSessionStatus>('idle');
  const [isActive, setIsActive] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  // ── Fase 1: array de turnos acumulados (substitui { user, model }) ────────
  const [turns, setTurns] = useState<TranscriptTurn[]>([]);

  const { startInput, stopInput, volume, isMuted, toggleMute } = useAudioInput();
  const { startOutput, stopOutput, enqueueAudio, clearQueue }   = useAudioOutput();

  const sessionRef            = useRef<any>(null);
  const highlightIntervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentModelTurnIdRef = useRef<string | null>(null);

  // ── Fase 2: Highlight progressivo ────────────────────────────────────────

  const clearHighlight = useCallback(() => {
    if (highlightIntervalRef.current) {
      clearInterval(highlightIntervalRef.current);
      highlightIntervalRef.current = null;
    }
  }, []);

  /**
   * Inicia um setInterval que avança `highlightIndex` palavra a palavra.
   * Quando o índice atinge o fim do texto, o intervalo é limpo e
   * highlightIndex volta a -1 (texto exibido normalmente).
   */
  const startHighlight = useCallback((turnId: string, wordCount: number) => {
    clearHighlight();
    let index = 0;

    highlightIntervalRef.current = setInterval(() => {
      index++;
      if (index >= wordCount) {
        clearHighlight();
        setTurns(prev =>
          prev.map(t => t.id === turnId ? { ...t, highlightIndex: -1 } : t),
        );
        return;
      }
      setTurns(prev =>
        prev.map(t => t.id === turnId ? { ...t, highlightIndex: index } : t),
      );
    }, MS_PER_WORD);
  }, [clearHighlight]);

  // ── Parar sessão ──────────────────────────────────────────────────────────

  const stopSession = useCallback(() => {
    clearHighlight();
    setIsActive(false);
    setStatus('idle');
    stopInput();
    stopOutput();
    if (sessionRef.current) {
      try { sessionRef.current.close(); } catch { /* ignore */ }
      sessionRef.current = null;
    }
  }, [stopInput, stopOutput, clearHighlight]);

  // ── Iniciar sessão ────────────────────────────────────────────────────────

  const startSession = useCallback(async () => {
    setError(null);
    setStatus('connecting');
    setTurns([]);
    currentModelTurnIdRef.current = null;

    const resolvedKey = apiKey ??
      (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_GEMINI_API_KEY : undefined);

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
            // ── Áudio ────────────────────────────────────────────────────
            const parts = message.serverContent?.modelTurn?.parts ?? [];
            for (const part of parts) {
              if (part.inlineData?.data) enqueueAudio(part.inlineData.data);
            }

            // ── Transcrição do utilizador ─────────────────────────────
            // inputTranscription chega como uma utterance completa após silêncio
            const userText = message.serverContent?.inputTranscription?.text;
            if (userText?.trim()) {
              const id = `user-${Date.now()}`;
              setTurns(prev =>
                [...prev, {
                  id,
                  role: 'user' as const,
                  text: userText.trim(),
                  highlightIndex: -1,   // utilizador nunca tem highlight
                }].slice(-MAX_TURNS),
              );
            }

            // ── Transcrição do modelo ─────────────────────────────────
            // outputTranscription pode chegar em vários chunks → acumula no mesmo turno
            const modelText = message.serverContent?.outputTranscription?.text;
            if (modelText?.trim()) {
              if (!currentModelTurnIdRef.current) {
                currentModelTurnIdRef.current = `model-${Date.now()}`;
              }
              const turnId = currentModelTurnIdRef.current;
              const words  = modelText.trim().split(/\s+/).filter(Boolean);

              setTurns(prev => {
                const last = prev[prev.length - 1];
                // Actualiza o turno em curso se o id já existe
                if (last?.id === turnId) {
                  return [...prev.slice(0, -1), { ...last, text: modelText.trim() }];
                }
                // Cria novo turno do modelo com highlight a começar na palavra 0
                return [
                  ...prev,
                  {
                    id: turnId,
                    role: 'model' as const,
                    text: modelText.trim(),
                    highlightIndex: 0,
                  },
                ].slice(-MAX_TURNS);
              });

              // Fase 2: inicia highlight para o número total de palavras recebidas
              startHighlight(turnId, words.length);
            }

            // ── Turno completo ────────────────────────────────────────
            if (message.serverContent?.turnComplete) {
              currentModelTurnIdRef.current = null;
            }

            // ── Interrupção ───────────────────────────────────────────
            if (message.serverContent?.interrupted) {
              clearQueue();
              clearHighlight();
              const turnId = currentModelTurnIdRef.current;
              if (turnId) {
                setTurns(prev =>
                  prev.map(t =>
                    t.id === turnId
                      ? { ...t, interrupted: true, highlightIndex: -1 }
                      : t,
                  ),
                );
                currentModelTurnIdRef.current = null;
              }
            }
          },

          onclose: () => stopSession(),
          onerror: (e: unknown) => {
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
  }, [apiKey, contextFiles, startInput, startOutput, enqueueAudio, clearQueue,
      stopSession, startHighlight, clearHighlight]);

  const toggleSession = useCallback(() => {
    if (isActive) stopSession();
    else startSession();
  }, [isActive, startSession, stopSession]);

  // Limpa interval ao desmontar
  useEffect(() => () => { clearHighlight(); }, [clearHighlight]);

  return {
    isActive,
    status,
    error,
    turns,         // substituiu `transcription`
    volume,
    isMuted,
    toggleMute,
    toggleSession,
    stopSession,
  };
}
