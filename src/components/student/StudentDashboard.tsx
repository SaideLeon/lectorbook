// src/components/student/StudentDashboard.tsx
import { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { createPortal } from 'react-dom';
import {
  X, Trophy, Target, BookOpen, Flame, TrendingUp,
  Crown, Medal, Award, Users, BarChart3, Calendar
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Student, RankingEntry, LEVEL_META, LEVEL_ORDER, XP_THRESHOLDS, getXpProgress } from '@/types/student';
import { LevelBadge } from './LevelBadge';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ─── Mini stat card ────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color: string }) {
  return (
    <div className="bg-[#1a1a1a] border border-white/8 rounded-xl p-3 space-y-1">
      <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center', color)}>
        <Icon className="w-3.5 h-3.5 text-white" />
      </div>
      <p className="text-lg font-bold text-white">{value}</p>
      <p className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</p>
    </div>
  );
}

// ─── XP Progress bar ──────────────────────────────────────────────────────────

function XpProgressBar({ xp }: { xp: number }) {
  const prog = getXpProgress(xp);
  const meta = LEVEL_META[prog.level];
  const nextMeta = prog.nextLevel ? LEVEL_META[prog.nextLevel] : null;

  return (
    <div className="bg-[#1a1a1a] border border-white/8 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">{meta.emoji}</span>
          <div>
            <p className={cn('text-sm font-bold', meta.color)}>{meta.label}</p>
            <p className="text-[10px] text-gray-500">{xp.toLocaleString()} XP total</p>
          </div>
        </div>
        {nextMeta && (
          <div className="text-right">
            <p className="text-[10px] text-gray-500">Próximo nível</p>
            <p className={cn('text-xs font-semibold', nextMeta.color)}>{nextMeta.emoji} {nextMeta.label}</p>
          </div>
        )}
      </div>

      <div className="space-y-1">
        <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${prog.percentage}%` }}
            transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
            className={cn('h-full rounded-full', {
              'bg-gradient-to-r from-amber-700 to-amber-500': prog.level === 'bronze',
              'bg-gradient-to-r from-slate-400 to-slate-200': prog.level === 'prata',
              'bg-gradient-to-r from-yellow-600 to-yellow-400': prog.level === 'ouro',
              'bg-gradient-to-r from-violet-700 to-violet-400': prog.level === 'epico',
              'bg-gradient-to-r from-rose-700 to-rose-400': prog.level === 'lendario',
            })}
          />
        </div>
        <div className="flex justify-between text-[10px] text-gray-600">
          <span>{XP_THRESHOLDS[prog.level].toLocaleString()} XP</span>
          {prog.nextLevel
            ? <span>{prog.percentage}% · faltam {(prog.next - xp).toLocaleString()} XP</span>
            : <span>Nível máximo! 👑</span>
          }
          {prog.nextLevel && <span>{prog.next.toLocaleString()} XP</span>}
        </div>
      </div>
    </div>
  );
}

// ─── Level roadmap ────────────────────────────────────────────────────────────

function LevelRoadmap({ currentLevel }: { currentLevel: string }) {
  const currentIdx = LEVEL_ORDER.indexOf(currentLevel as any);
  return (
    <div className="bg-[#1a1a1a] border border-white/8 rounded-xl p-4 space-y-2">
      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Jornada de Níveis</p>
      <div className="flex items-center gap-1">
        {LEVEL_ORDER.map((lvl, idx) => {
          const meta = LEVEL_META[lvl];
          const isActive = idx === currentIdx;
          const isDone = idx < currentIdx;
          return (
            <div key={lvl} className="flex items-center gap-1 flex-1">
              <div className={cn(
                'flex flex-col items-center gap-1 flex-1',
                isDone ? 'opacity-100' : isActive ? 'opacity-100' : 'opacity-30',
              )}>
                <div className={cn(
                  'w-8 h-8 rounded-xl flex items-center justify-center text-base border-2 transition-all',
                  isActive ? cn(meta.border, meta.bg, 'scale-110 shadow-lg') : isDone ? 'border-green-500/40 bg-green-500/10' : 'border-white/10 bg-white/5',
                )}>
                  {isDone ? '✓' : meta.emoji}
                </div>
                <span className={cn('text-[9px] font-medium', isActive ? meta.color : 'text-gray-600')}>
                  {meta.label}
                </span>
              </div>
              {idx < LEVEL_ORDER.length - 1 && (
                <div className={cn('w-4 h-px', idx < currentIdx ? 'bg-green-500/50' : 'bg-white/10')} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Ranking row ──────────────────────────────────────────────────────────────

function RankRow({ entry, isCurrentUser }: { entry: RankingEntry; isCurrentUser: boolean }) {
  const meta = LEVEL_META[entry.level];
  const rankIcons: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all',
        isCurrentUser
          ? 'bg-indigo-500/10 border-indigo-500/30'
          : 'bg-white/3 border-white/5 hover:bg-white/5',
      )}
    >
      <span className="w-8 text-center text-sm font-bold">
        {rankIcons[entry.rank_position] || `#${entry.rank_position}`}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className={cn('text-sm font-medium truncate', isCurrentUser ? 'text-indigo-300' : 'text-gray-200')}>
            {entry.name}
          </p>
          {entry.gender && <span className="text-[10px] text-gray-600">{entry.gender === 'M' ? '♂' : '♀'}</span>}
          {isCurrentUser && <span className="text-[9px] bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded-full font-medium">Você</span>}
        </div>
        {entry.class && <p className="text-[10px] text-gray-600">{entry.class} · {entry.avg_percentage}% média</p>}
      </div>
      <div className="text-right shrink-0">
        <span className={cn('text-xs font-semibold', meta.color)}>{meta.emoji} {meta.label}</span>
        <p className="text-[10px] text-gray-500">{entry.total_xp.toLocaleString()} XP</p>
      </div>
    </motion.div>
  );
}

// ─── Main Dashboard ────────────────────────────────────────────────────────────

interface StudentDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student;
  ranking: RankingEntry[];
  onEditProfile: () => void;
  onLoadRanking: (cls?: string) => void;
}

export function StudentDashboard({ isOpen, onClose, student, ranking, onEditProfile, onLoadRanking }: StudentDashboardProps) {
  useEffect(() => {
    if (isOpen) onLoadRanking(student.class || undefined);
  }, [isOpen]);

  const myRankEntry = ranking.find(r => r.id === student.id);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[110]"
          />
          <motion.div
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 220 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-sm bg-[#111] border-l border-white/10 z-[111] flex flex-col overflow-hidden shadow-2xl"
          >
            {/* Header */}
            <div className="relative h-28 bg-gradient-to-br from-indigo-600/30 via-violet-600/20 to-transparent shrink-0">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(99,102,241,0.25),transparent_60%)]" />
              <button onClick={onClose} className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors z-10">
                <X className="w-4 h-4" />
              </button>

              <div className="absolute bottom-0 translate-y-1/2 left-5">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-xl border-2 border-[#111] text-2xl">
                  {student.gender === 'F' ? '👩' : student.gender === 'M' ? '👨' : '🎓'}
                </div>
              </div>
            </div>

            <div className="pt-12 px-4 pb-2 shrink-0">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-base font-bold text-white">{student.name}</h2>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    {student.class && <span className="text-[10px] text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">{student.class}</span>}
                    <span className="text-[10px] text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">{student.course}</span>
                    {myRankEntry && <span className="text-[10px] text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full font-medium">#{myRankEntry.rank_position}</span>}
                  </div>
                </div>
                <button
                  onClick={onEditProfile}
                  className="text-[10px] text-gray-500 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 px-2 py-1 rounded-lg transition-colors mt-1"
                >
                  Editar
                </button>
              </div>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-3">
              {/* XP Bar */}
              <XpProgressBar xp={student.total_xp} />

              {/* Stats grid */}
              <div className="grid grid-cols-3 gap-2">
                <StatCard icon={Trophy} label="Testes" value={student.quizzes_completed} color="bg-indigo-600" />
                <StatCard icon={Target} label="Média" value={`${Math.round(student.avg_percentage)}%`} color="bg-emerald-600" />
                <StatCard icon={Flame} label="XP Total" value={student.total_xp} color="bg-rose-600" />
              </div>

              {/* Level roadmap */}
              <LevelRoadmap currentLevel={student.level} />

              {/* Last study */}
              {student.last_study_at && (
                <div className="flex items-center gap-2 px-3 py-2 bg-white/3 border border-white/8 rounded-xl text-xs text-gray-500">
                  <Calendar className="w-3.5 h-3.5 shrink-0" />
                  <span>Último estudo: {formatDistanceToNow(new Date(student.last_study_at), { addSuffix: true, locale: ptBR })}</span>
                </div>
              )}

              {/* Ranking */}
              {ranking.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                      <Crown className="w-3.5 h-3.5 text-yellow-500" />
                      Ranking {student.class ? `— Turma ${student.class}` : 'Geral'}
                    </p>
                    <button
                      onClick={() => onLoadRanking(undefined)}
                      className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      Geral
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {ranking.slice(0, 10).map((entry, i) => (
                      <RankRow key={entry.id} entry={entry} isCurrentUser={entry.id === student.id} />
                    ))}
                  </div>
                </div>
              )}

              {ranking.length === 0 && (
                <div className="text-center py-8 space-y-2">
                  <Users className="w-10 h-10 text-gray-700 mx-auto" />
                  <p className="text-sm text-gray-500">Sem dados de ranking ainda.</p>
                  <p className="text-xs text-gray-600">Completa um teste para aparecer no ranking!</p>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
