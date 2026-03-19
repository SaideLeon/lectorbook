'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Mic, MicOff, Volume2, VolumeX, ArrowLeft,
  Radio, AlertCircle, Loader2, BookOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLiveVoice, TranscriptTurn } from '@/hooks/useLiveVoice';

// ─── Animated waveform bars ───────────────────────────────────────────────────
function WaveformBars({ volume, isActive, isMuted }: { volume: number; isActive: boolean; isMuted: boolean }) {
  const BAR_COUNT = 20;
  return (
    <div className="flex items-center justify-center gap-[3px] h-16" aria-hidden>
      {Array.from({ length: BAR_COUNT }, (_, i) => {
        const phase = (i / BAR_COUNT) * Math.PI * 2;
        const sine  = Math.sin(phase);
        const raw   = isActive && !isMuted ? Math.max(0.08, volume * 8 * (0.6 + 0.4 * Math.abs(sine))) : 0.08;
        const height = Math.min(1, raw);

        return (
          <motion.div
            key={i}
            animate={{ scaleY: height, opacity: isActive ? 0.7 + height * 0.3 : 0.25 }}
            transition={{ duration: 0.06, ease: 'linear' }}
            className={cn(
              'w-[3px] rounded-full origin-center',
              isMuted ? 'bg-gray-600' : 'bg-indigo-400',
            )}
            style={{ height: 48 }}
          />
        );
      })}
    </div>
  );
}

// ─── Pulsing orb ─────────────────────────────────────────────────────────────
function LiveOrb({ isActive, volume }: { isActive: boolean; volume: number }) {
  const scale = isActive ? 1 + Math.min(volume * 4, 0.4) : 1;
  return (
    <div className="relative flex items-center justify-center w-36 h-36">
      <AnimatePresence>
        {isActive && (
          <>
            <motion.div
              key="ring-outer"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: [1, 1.5], opacity: [0.3, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
              className="absolute inset-0 rounded-full border border-indigo-500/60"
            />
            <motion.div
              key="ring-mid"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: [1, 1.3], opacity: [0.25, 0] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut', delay: 0.4 }}
              className="absolute inset-0 rounded-full border border-indigo-400/40"
            />
          </>
        )}
      </AnimatePresence>

      <motion.div
        animate={{ scale }}
        transition={{ duration: 0.05, ease: 'linear' }}
        className={cn(
          'w-28 h-28 rounded-full flex items-center justify-center shadow-2xl transition-colors duration-300',
          isActive
            ? 'bg-gradient-to-br from-indigo-600 to-violet-700 shadow-indigo-500/30'
            : 'bg-[#1c1c2e] border border-white/10',
        )}
      >
        <AnimatePresence mode="wait">
          {isActive ? (
            <motion.div key="mic-off" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
              <MicOff className="w-10 h-10 text-white/90" />
            </motion.div>
          ) : (
            <motion.div key="mic-on" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
              <Mic className="w-10 h-10 text-indigo-400" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

// ─── Fase 3: Balão de diálogo com highlight palavra a palavra ────────────────
function TurnBubble({ turn }: { turn: TranscriptTurn }) {
  const isUser = turn.role === 'user';
  const words  = turn.text.trim().split(/\s+/).filter(Boolean);
  const ref    = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [turn.text, turn.highlightIndex]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 10, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className={cn('flex w-full', isUser ? 'justify-end' : 'justify-start')}
    >
      <div
        className={cn(
          'max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
          isUser
            ? 'bg-[#252535] text-gray-200 rounded-br-sm border border-white/8'
            : 'bg-indigo-500/12 border border-indigo-500/25 text-gray-100 rounded-bl-sm',
          turn.interrupted && 'opacity-55',
        )}
      >
        {/* Label */}
        <p className={cn(
          'text-[9px] font-bold uppercase tracking-[0.12em] mb-1.5',
          isUser ? 'text-gray-600 text-right' : 'text-indigo-400',
        )}>
          {isUser ? 'Você' : 'Lector'}
          {turn.interrupted && (
            <span className="ml-1.5 text-red-400/70 normal-case tracking-normal font-normal">
              · interrompido
            </span>
          )}
        </p>

        {/* Palavras com highlight progressivo (Fase 2 + 3) */}
        <span className="inline">
          {words.map((word, idx) => {
            // Utilizador: sem highlight, texto simples
            if (isUser) {
              return (
                <span key={idx}>
                  {word}{idx < words.length - 1 ? ' ' : ''}
                </span>
              );
            }

            const isActive = turn.highlightIndex === idx;
            const isPast   = turn.highlightIndex > idx || turn.highlightIndex === -1;
            const isFuture = turn.highlightIndex !== -1 && turn.highlightIndex < idx;

            return (
              <span key={idx}>
                <motion.span
                  animate={isActive ? { scale: 1.1 } : { scale: 1 }}
                  transition={{ duration: 0.1, ease: 'easeOut' }}
                  className={cn(
                    'inline-block transition-colors duration-150',
                    isPast   && 'text-gray-200',
                    isActive && 'text-white font-semibold drop-shadow-[0_0_8px_rgba(139,92,246,0.8)]',
                    isFuture && 'text-gray-500',
                  )}
                >
                  {word}
                </motion.span>
                {idx < words.length - 1 ? ' ' : ''}
              </span>
            );
          })}
        </span>
      </div>
    </motion.div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: 'idle' | 'connecting' | 'active' | 'error' }) {
  const map = {
    idle:       { label: 'Pronto',      dotCls: 'bg-gray-600' },
    connecting: { label: 'Conectando…', dotCls: 'bg-amber-400 animate-pulse' },
    active:     { label: 'Ao vivo',     dotCls: 'bg-emerald-400 animate-pulse' },
    error:      { label: 'Erro',        dotCls: 'bg-red-500' },
  };
  const { label, dotCls } = map[status];
  return (
    <div className="flex items-center gap-1.5">
      <div className={cn('w-2 h-2 rounded-full shrink-0', dotCls)} />
      <span className="text-[11px] font-mono uppercase tracking-widest text-gray-500">{label}</span>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────
interface LiveVoicePanelProps {
  contextFiles: { path: string; content: string }[];
  apiKey?: string;
  onBack: () => void;
}

export function LiveVoicePanel({ contextFiles, apiKey, onBack }: LiveVoicePanelProps) {
  const {
    isActive, status, error, turns,
    volume, isMuted, toggleMute, toggleSession,
  } = useLiveVoice({ contextFiles, apiKey });

  const transcriptRef = useRef<HTMLDivElement>(null);

  // Scroll automático ao fundo quando chegam novos turnos ou actualizações de highlight
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [turns]);

  return (
    <div className="flex flex-col bg-[#111] rounded-xl border border-white/10 overflow-hidden h-[96%]">

      {/* ── Header ── */}
      <div className="px-4 py-3 border-b border-white/10 bg-[#151515] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-indigo-400" />
          <h3 className="font-medium text-sm">Conversa ao Vivo — Lector</h3>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={status} />
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Chat
          </button>
        </div>
      </div>

      {/* ── Context pill ── */}
      <div className="px-4 pt-3 shrink-0">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-500/8 border border-indigo-500/20 text-xs text-indigo-300">
          <BookOpen className="w-3.5 h-3.5 shrink-0" />
          {contextFiles.length > 0
            ? `${contextFiles.length} ficheiro(s) carregados como contexto do Lector`
            : 'Sem contexto de repositório — modo geral activado'}
        </div>
      </div>

      {/* ── Orb + waveform ── */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6 py-4 overflow-hidden">
        <AnimatePresence>
          {isActive && (
            <motion.div
              key="glow"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute w-72 h-72 rounded-full bg-indigo-600/8 blur-3xl pointer-events-none"
            />
          )}
        </AnimatePresence>

        <button
          onClick={toggleSession}
          disabled={status === 'connecting'}
          className="relative z-10 focus:outline-none disabled:cursor-wait"
          title={isActive ? 'Encerrar conversa' : 'Iniciar conversa ao vivo'}
        >
          <LiveOrb isActive={isActive} volume={volume} />
          {status === 'connecting' && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
            </div>
          )}
        </button>

        <div className="relative z-10 w-full max-w-xs">
          <WaveformBars volume={volume} isActive={isActive} isMuted={isMuted} />
        </div>

        <AnimatePresence>
          {status === 'idle' && (
            <motion.p
              key="cta"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-xs text-gray-500 text-center relative z-10"
            >
              Clique no orb para iniciar uma conversa de voz com o Lector
            </motion.p>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {error && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="relative z-10 flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs max-w-sm text-center"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Fase 3: Área de transcrição — balões de diálogo ── */}
      <div className="shrink-0 border-t border-white/8 bg-[#0f0f0f]">
        {/* Container aumentado de h-28 → h-56 */}
        <div
          ref={transcriptRef}
          className="h-56 overflow-y-auto px-4 py-3 space-y-2.5
                     scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
        >
          <AnimatePresence initial={false}>
            {turns.length === 0 ? (
              <motion.p
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-[11px] text-gray-600 italic text-center pt-4"
              >
                As transcrições da conversa aparecerão aqui…
              </motion.p>
            ) : (
              turns.map(turn => (
                <TurnBubble key={turn.id} turn={turn} />
              ))
            )}
          </AnimatePresence>
        </div>

        {/* Barra de controlos */}
        <div className="flex items-center justify-between px-4 pb-3">
          <p className="text-[10px] text-gray-600">
            {isActive ? 'Sessão activa — fale naturalmente' : 'Sessão encerrada'}
          </p>
          {isActive && (
            <button
              onClick={toggleMute}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all',
                isMuted
                  ? 'bg-red-500/15 border-red-500/30 text-red-300 hover:bg-red-500/25'
                  : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10',
              )}
            >
              {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              {isMuted ? 'Activar mic' : 'Silenciar mic'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
