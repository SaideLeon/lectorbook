// src/components/student/StudentDashboard.tsx
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { createPortal } from 'react-dom';
import {
  X, Trophy, Target, Flame, Calendar, Crown, Users,
  CheckCircle2, XCircle, ChevronDown, ChevronRight,
  BarChart3, History, Star, GitBranch, Globe,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Student, RankingEntry, RepoRankingEntry, QuizResultWithAnswers,
  LEVEL_META, LEVEL_ORDER, XP_THRESHOLDS, getXpProgress,
} from '@/types/student';
import { LevelBadge } from './LevelBadge';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type DashTab = 'perfil' | 'historico' | 'ranking';

// ─── Stat card ────────────────────────────────────────────────────────────────
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

// ─── XP Progress ──────────────────────────────────────────────────────────────
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
              'bg-gradient-to-r from-rose-700 to-rose-400':    prog.level === 'lendario',
            })}
          />
        </div>
        <div className="flex justify-between text-[10px] text-gray-600">
          <span>{XP_THRESHOLDS[prog.level].toLocaleString()} XP</span>
          {prog.nextLevel
            ? <span>{prog.percentage}% · faltam {(prog.next - xp).toLocaleString()} XP</span>
            : <span>Nível máximo! 👑</span>}
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
              <div className={cn('flex flex-col items-center gap-1 flex-1', !isDone && !isActive && 'opacity-30')}>
                <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center text-base border-2 transition-all',
                  isActive ? cn(meta.border, meta.bg, 'scale-110 shadow-lg') :
                  isDone ? 'border-green-500/40 bg-green-500/10' : 'border-white/10 bg-white/5'
                )}>
                  {isDone ? '✓' : meta.emoji}
                </div>
                <span className={cn('text-[9px] font-medium', isActive ? meta.color : 'text-gray-600')}>{meta.label}</span>
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

// ─── Quiz History Item ────────────────────────────────────────────────────────
function QuizHistoryItem({ result }: { result: QuizResultWithAnswers }) {
  const [expanded, setExpanded] = useState(false);
  const pct = result.percentage;
  const color = pct >= 90 ? 'text-emerald-400' : pct >= 70 ? 'text-blue-400' : pct >= 50 ? 'text-amber-400' : 'text-red-400';
  const borderColor = pct >= 90 ? 'border-emerald-500/20' : pct >= 70 ? 'border-blue-500/20' : pct >= 50 ? 'border-amber-500/20' : 'border-red-500/20';
  const bgColor = pct >= 90 ? 'bg-emerald-500/5' : pct >= 70 ? 'bg-blue-500/5' : pct >= 50 ? 'bg-amber-500/5' : 'bg-red-500/5';

  const repoLabel = result.repo_full_name?.split('/').pop() || 'Repositório';

  return (
    <div className={cn('rounded-xl border overflow-hidden', borderColor, bgColor)}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-white/3 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn('text-base font-bold', color)}>{pct}%</span>
            <span className="text-xs text-gray-400">{result.score}/{result.total_questions} corretas</span>
            <span className="text-[10px] bg-indigo-500/15 text-indigo-400 px-1.5 py-0.5 rounded-full">+{result.xp_earned} XP</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-gray-600 truncate">{repoLabel}</span>
            <span className="text-[10px] text-gray-700">·</span>
            <span className="text-[10px] text-gray-600">
              {formatDistanceToNow(new Date(result.created_at), { addSuffix: true, locale: ptBR })}
            </span>
          </div>
        </div>
        {result.quiz_answers && result.quiz_answers.length > 0 && (
          expanded ? <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-500 shrink-0" />
        )}
      </button>

      {/* Detailed answers */}
      <AnimatePresence>
        {expanded && result.quiz_answers && result.quiz_answers.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-2 border-t border-white/5 pt-3">
              {result.quiz_answers
                .slice()
                .sort((a, b) => a.question_index - b.question_index)
                .map((ans) => (
                  <div key={ans.id} className={cn('rounded-lg p-2.5 text-xs space-y-1.5',
                    ans.is_correct ? 'bg-emerald-500/8 border border-emerald-500/15' : 'bg-red-500/8 border border-red-500/15'
                  )}>
                    <div className="flex items-start gap-2">
                      {ans.is_correct
                        ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        : <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />}
                      <span className="text-gray-200 leading-relaxed font-medium">{ans.question_text}</span>
                    </div>
                    {!ans.is_correct && (
                      <div className="pl-5 space-y-1 text-[11px]">
                        {ans.selected_index !== null && (
                          <p className="text-red-400">
                            Sua resposta: <span className="font-medium">{ans.options[ans.selected_index]}</span>
                          </p>
                        )}
                        <p className="text-emerald-400">
                          Correcta: <span className="font-medium">{ans.options[ans.correct_index]}</span>
                        </p>
                        {ans.explanation && <p className="text-gray-500">{ans.explanation}</p>}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Ranking Row ──────────────────────────────────────────────────────────────
function RankRow({ entry, isCurrentUser, mode }: {
  entry: RankingEntry | RepoRankingEntry;
  isCurrentUser: boolean;
  mode: 'global' | 'repo';
}) {
  const meta = LEVEL_META[entry.level];
  const rankIcons: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };
  const pos = entry.rank_position;
  const avgPct = 'avg_percentage' in entry ? Number(entry.avg_percentage) : 0;
  const xpLabel = mode === 'repo'
    ? `${(entry as RepoRankingEntry).xp_in_repo?.toLocaleString()} XP neste repo`
    : `${(entry as RankingEntry).total_xp?.toLocaleString()} XP total`;

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn('flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all',
        isCurrentUser ? 'bg-indigo-500/10 border-indigo-500/30' : 'bg-white/3 border-white/5 hover:bg-white/5'
      )}
    >
      <span className="w-8 text-center text-sm font-bold shrink-0">
        {rankIcons[pos] || `#${pos}`}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className={cn('text-sm font-medium truncate', isCurrentUser ? 'text-indigo-300' : 'text-gray-200')}>
            {entry.name}
          </p>
          {entry.gender && <span className="text-[10px] text-gray-600">{entry.gender === 'M' ? '♂' : '♀'}</span>}
          {isCurrentUser && (
            <span className="text-[9px] bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded-full font-medium">Você</span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {entry.class && <p className="text-[10px] text-gray-600">{entry.class}</p>}
          <p className="text-[10px] text-gray-600">{Math.round(avgPct)}% média</p>
          {mode === 'repo' && (
            <p className="text-[10px] text-gray-600">{(entry as RepoRankingEntry).quizzes_count}x</p>
          )}
        </div>
      </div>
      <div className="text-right shrink-0">
        <span className={cn('text-xs font-semibold', meta.color)}>{meta.emoji} {meta.label}</span>
        <p className="text-[10px] text-gray-500">{xpLabel}</p>
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
  repoRanking: RepoRankingEntry[];
  quizHistory: QuizResultWithAnswers[];
  isLoadingHistory: boolean;
  currentRepoFullName?: string;
  onEditProfile: () => void;
  onLoadRanking: (cls?: string, repo?: string) => void;
  onLoadHistory: (repo?: string) => void;
}

export function StudentDashboard({
  isOpen, onClose, student, ranking, repoRanking, quizHistory,
  isLoadingHistory, currentRepoFullName, onEditProfile, onLoadRanking, onLoadHistory,
}: StudentDashboardProps) {
  const [tab, setTab] = useState<DashTab>('perfil');
  const [rankingMode, setRankingMode] = useState<'global' | 'repo'>('global');

  useEffect(() => {
    if (!isOpen) return;
    onLoadRanking(student.class || undefined);
    onLoadHistory();
    if (currentRepoFullName) {
      onLoadRanking(undefined, currentRepoFullName);
    }
  }, [isOpen]);

  const myRankEntry = ranking.find((r) => r.id === student.id);
  const myRepoRankEntry = repoRanking.find((r) => r.id === student.id);
  const activeRanking = rankingMode === 'repo' && repoRanking.length > 0 ? repoRanking : ranking;

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
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
            {/* Avatar header */}
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

            {/* Name + edit */}
            <div className="pt-12 px-4 pb-3 shrink-0">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-base font-bold text-white">{student.name}</h2>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    {student.class && <span className="text-[10px] text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">{student.class}</span>}
                    <span className="text-[10px] text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">{student.course}</span>
                    {myRankEntry && (
                      <span className="text-[10px] text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full font-medium">
                        #{myRankEntry.rank_position} global
                      </span>
                    )}
                    {myRepoRankEntry && (
                      <span className="text-[10px] text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-full font-medium">
                        #{myRepoRankEntry.rank_position} neste repo
                      </span>
                    )}
                  </div>
                </div>
                <button onClick={onEditProfile} className="text-[10px] text-gray-500 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 px-2 py-1 rounded-lg transition-colors mt-1">
                  Editar
                </button>
              </div>
            </div>

            {/* Tab bar */}
            <div className="flex border-b border-white/10 shrink-0 px-2">
              {([
                { id: 'perfil',    icon: Trophy,   label: 'Perfil' },
                { id: 'historico', icon: History,   label: 'Histórico' },
                { id: 'ranking',   icon: Crown,     label: 'Ranking' },
              ] as { id: DashTab; icon: any; label: string }[]).map(({ id, icon: Icon, label }) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={cn('flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors border-b-2',
                    tab === id ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-300'
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto">
              <AnimatePresence mode="wait">

                {/* ── PERFIL TAB ── */}
                {tab === 'perfil' && (
                  <motion.div key="perfil" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="px-4 py-4 space-y-3">
                    <XpProgressBar xp={student.total_xp} />
                    <div className="grid grid-cols-3 gap-2">
                      <StatCard icon={Trophy}   label="Testes"  value={student.quizzes_completed}            color="bg-indigo-600" />
                      <StatCard icon={Target}   label="Média"   value={`${Math.round(student.avg_percentage)}%`} color="bg-emerald-600" />
                      <StatCard icon={Flame}    label="XP"      value={student.total_xp}                    color="bg-rose-600" />
                    </div>
                    <LevelRoadmap currentLevel={student.level} />
                    {student.last_study_at && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-white/3 border border-white/8 rounded-xl text-xs text-gray-500">
                        <Calendar className="w-3.5 h-3.5 shrink-0" />
                        <span>Último estudo: {formatDistanceToNow(new Date(student.last_study_at), { addSuffix: true, locale: ptBR })}</span>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* ── HISTÓRICO TAB ── */}
                {tab === 'historico' && (
                  <motion.div key="historico" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="px-4 py-4 space-y-3">
                    {/* Filter buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => onLoadHistory()}
                        className="flex-1 py-1.5 text-[11px] rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-gray-300 transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Globe className="w-3 h-3" /> Todos
                      </button>
                      {currentRepoFullName && (
                        <button
                          onClick={() => onLoadHistory(currentRepoFullName)}
                          className="flex-1 py-1.5 text-[11px] rounded-lg border border-violet-500/30 bg-violet-500/10 hover:bg-violet-500/15 text-violet-300 transition-colors flex items-center justify-center gap-1.5"
                        >
                          <GitBranch className="w-3 h-3" />
                          <span className="truncate">{currentRepoFullName.split('/').pop()}</span>
                        </button>
                      )}
                    </div>

                    {isLoadingHistory ? (
                      <div className="flex items-center justify-center py-12 gap-2 text-gray-500">
                        <div className="w-4 h-4 rounded-full border-2 border-indigo-500/40 border-t-indigo-400 animate-spin" />
                        <span className="text-xs">Carregando histórico...</span>
                      </div>
                    ) : quizHistory.length === 0 ? (
                      <div className="text-center py-12 space-y-2">
                        <History className="w-10 h-10 text-gray-700 mx-auto" />
                        <p className="text-sm text-gray-500">Sem histórico de testes.</p>
                        <p className="text-xs text-gray-600">Complete um teste para ver o histórico com revisão das respostas.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-[10px] text-gray-600 font-medium">{quizHistory.length} teste(s) realizados</p>
                        {quizHistory.map((r) => <QuizHistoryItem key={r.id} result={r} />)}
                      </div>
                    )}
                  </motion.div>
                )}

                {/* ── RANKING TAB ── */}
                {tab === 'ranking' && (
                  <motion.div key="ranking" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="px-4 py-4 space-y-3">
                    {/* Mode toggle */}
                    <div className="flex gap-2 p-1 bg-white/5 rounded-xl border border-white/8">
                      <button
                        onClick={() => { setRankingMode('global'); onLoadRanking(student.class || undefined); }}
                        className={cn('flex-1 py-1.5 text-[11px] rounded-lg font-medium transition-colors flex items-center justify-center gap-1.5',
                          rankingMode === 'global' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
                        )}
                      >
                        <Globe className="w-3 h-3" /> Global
                      </button>
                      <button
                        onClick={() => {
                          setRankingMode('repo');
                          if (currentRepoFullName) onLoadRanking(undefined, currentRepoFullName);
                        }}
                        disabled={!currentRepoFullName}
                        className={cn('flex-1 py-1.5 text-[11px] rounded-lg font-medium transition-colors flex items-center justify-center gap-1.5',
                          rankingMode === 'repo' ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-white',
                          !currentRepoFullName && 'opacity-40 cursor-not-allowed'
                        )}
                      >
                        <GitBranch className="w-3 h-3" />
                        {currentRepoFullName ? currentRepoFullName.split('/').pop() : 'Por Repo'}
                      </button>
                    </div>

                    {/* Ranking label */}
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                        <Crown className="w-3.5 h-3.5 text-yellow-500" />
                        {rankingMode === 'repo'
                          ? `Ranking — ${currentRepoFullName?.split('/').pop()}`
                          : student.class ? `Ranking — Turma ${student.class}` : 'Ranking Geral'
                        }
                      </p>
                      {rankingMode === 'global' && student.class && (
                        <button onClick={() => onLoadRanking(undefined)} className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors">
                          Geral
                        </button>
                      )}
                    </div>

                    {/* How ranking works info */}
                    <div className="text-[10px] text-gray-600 bg-white/3 border border-white/8 rounded-lg px-3 py-2 leading-relaxed">
                      {rankingMode === 'global'
                        ? '🌐 Ranking global ordenado por XP total. Cada teste em qualquer repositório conta para a pontuação.'
                        : '📂 Ranking deste repositório baseado na média de percentagem e XP ganho nos testes deste material.'}
                    </div>

                    {/* Rank list */}
                    {activeRanking.length === 0 ? (
                      <div className="text-center py-8 space-y-2">
                        <Users className="w-10 h-10 text-gray-700 mx-auto" />
                        <p className="text-sm text-gray-500">
                          {rankingMode === 'repo' ? 'Ainda não há participantes neste repositório.' : 'Sem dados de ranking ainda.'}
                        </p>
                        <p className="text-xs text-gray-600">Completa um teste para aparecer no ranking!</p>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {(activeRanking as any[]).slice(0, 20).map((entry) => (
                          <RankRow
                            key={`${entry.id}-${rankingMode}`}
                            entry={entry}
                            isCurrentUser={entry.id === student.id}
                            mode={rankingMode}
                          />
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
