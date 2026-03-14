// src/types/student.ts

export type Gender = 'M' | 'F';
export type StudentLevel = 'bronze' | 'prata' | 'ouro' | 'epico' | 'lendario';

export interface Student {
  id: string;
  session_key: string;
  name: string;
  class: string | null;
  course: string;
  gender: Gender | null;
  total_xp: number;
  level: StudentLevel;
  quizzes_completed: number;
  avg_percentage: number;
  modules_studied: number;
  study_streak: number;
  last_study_at: string | null;
  created_at: string;
}

export interface QuizAnswer {
  id: string;
  quiz_result_id: string;
  question_index: number;
  question_text: string;
  options: string[];
  correct_index: number;
  selected_index: number | null;
  is_correct: boolean;
  explanation: string | null;
  source: string | null;
}

export interface QuizResult {
  id: string;
  student_id: string;
  repo_full_name: string | null;
  score: number;
  total_questions: number;
  percentage: number;
  xp_earned: number;
  level_before: StudentLevel;
  level_after: StudentLevel;
  created_at: string;
}

export interface QuizResultWithAnswers extends QuizResult {
  answers: QuizAnswer[];
  student_name?: string;
}

export interface RankingEntry {
  id: string;
  name: string;
  class: string | null;
  gender: Gender | null;
  total_xp: number;
  level: StudentLevel;
  quizzes_completed: number;
  avg_percentage: number;
  last_study_at: string | null;
  rank_position: number;
  repos_count?: number;
  avg_repo_position?: number;
}

export interface RepoRankingEntry {
  id: string;
  name: string;
  class: string | null;
  gender: Gender | null;
  level: StudentLevel;
  repo_full_name: string;
  quizzes_count: number;
  avg_percentage: number;
  xp_in_repo: number;
  best_score: number;
  rank_position: number;
}

// ─── XP & Level utilities ────────────────────────────────────────────────────

export const XP_THRESHOLDS: Record<StudentLevel, number> = {
  bronze:   0,
  prata:    200,
  ouro:     500,
  epico:    1000,
  lendario: 2000,
};

export const LEVEL_ORDER: StudentLevel[] = ['bronze', 'prata', 'ouro', 'epico', 'lendario'];

export const LEVEL_META: Record<StudentLevel, { label: string; emoji: string; color: string; bg: string; border: string }> = {
  bronze:   { label: 'Bronze',    emoji: '🥉', color: 'text-amber-600',   bg: 'bg-amber-600/10',   border: 'border-amber-600/30' },
  prata:    { label: 'Prata',     emoji: '🥈', color: 'text-slate-300',   bg: 'bg-slate-400/10',   border: 'border-slate-400/30' },
  ouro:     { label: 'Ouro',      emoji: '🥇', color: 'text-yellow-400',  bg: 'bg-yellow-400/10',  border: 'border-yellow-400/30' },
  epico:    { label: 'Épico',     emoji: '💠', color: 'text-violet-400',  bg: 'bg-violet-400/10',  border: 'border-violet-400/30' },
  lendario: { label: 'Lendário',  emoji: '👑', color: 'text-rose-400',    bg: 'bg-rose-400/10',    border: 'border-rose-400/30' },
};

export function getLevelFromXp(xp: number): StudentLevel {
  for (let i = LEVEL_ORDER.length - 1; i >= 0; i--) {
    if (xp >= XP_THRESHOLDS[LEVEL_ORDER[i]]) return LEVEL_ORDER[i];
  }
  return 'bronze';
}

export function getXpProgress(xp: number): {
  current: number;
  next: number;
  percentage: number;
  level: StudentLevel;
  nextLevel: StudentLevel | null;
} {
  const level = getLevelFromXp(xp);
  const levelIndex = LEVEL_ORDER.indexOf(level);
  const nextLevel = levelIndex < LEVEL_ORDER.length - 1 ? LEVEL_ORDER[levelIndex + 1] : null;

  const currentThreshold = XP_THRESHOLDS[level];
  const nextThreshold = nextLevel ? XP_THRESHOLDS[nextLevel] : XP_THRESHOLDS[level];

  if (!nextLevel) return { current: xp, next: nextThreshold, percentage: 100, level, nextLevel: null };

  const progress = xp - currentThreshold;
  const range = nextThreshold - currentThreshold;

  return {
    current: xp,
    next: nextThreshold,
    percentage: Math.min(100, Math.round((progress / range) * 100)),
    level,
    nextLevel,
  };
}

export function calcQuizXp(percentage: number, questionCount: number): number {
  const base = Math.round((percentage / 100) * questionCount * 5);
  const bonus = percentage >= 90 ? 50 : percentage >= 70 ? 20 : 0;
  return base + bonus;
}
