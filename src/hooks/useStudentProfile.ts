// src/hooks/useStudentProfile.ts
import { useState, useCallback, useEffect } from 'react';
import { Student, QuizResult, QuizResultWithAnswers, RankingEntry, RepoRankingEntry } from '@/types/student';
import { QuizQuestion } from '@/types';

const SESSION_KEY_STORAGE = 'lectorbook-student-session';

function createSessionKey(): string {
  return `sk_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function getOrCreateSessionKey(): string {
  if (typeof window === 'undefined') return '';
  let key = localStorage.getItem(SESSION_KEY_STORAGE);
  if (!key) {
    key = createSessionKey();
    localStorage.setItem(SESSION_KEY_STORAGE, key);
  }
  return key;
}

export type StudentAuthMode = 'signup' | 'login' | 'edit';

export function useStudentProfile() {
  const [student, setStudent]               = useState<Student | null>(null);
  const [isLoading, setIsLoading]           = useState(false);
  const [isProfileOpen, setIsProfileOpen]   = useState(false);
  const [authMode, setAuthMode]             = useState<StudentAuthMode>('signup');
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const [ranking, setRanking]               = useState<RankingEntry[]>([]);
  const [repoRanking, setRepoRanking]       = useState<RepoRankingEntry[]>([]);
  const [quizHistory, setQuizHistory]       = useState<QuizResultWithAnswers[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [levelUpInfo, setLevelUpInfo]       = useState<{ from: string; to: string; xp: number } | null>(null);
  const [sessionKey]                        = useState<string>(() => getOrCreateSessionKey());
  const [lastAccessCode, setLastAccessCode] = useState<string | null>(null);

  const persistSessionKey = useCallback((key: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(SESSION_KEY_STORAGE, key);
    }
  }, []);

  useEffect(() => {
    if (!sessionKey) return;
    loadProfile();
  }, [sessionKey]);

  const loadProfile = useCallback(async () => {
    if (!sessionKey) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/student/profile?session_key=${encodeURIComponent(sessionKey)}`);
      if (res.ok) {
        const { student: data } = await res.json();
        setStudent(data);
      }
    } catch {
      console.info('[useStudentProfile] Supabase não disponível.');
    } finally {
      setIsLoading(false);
    }
  }, [sessionKey]);

  const createProfile = useCallback(async (name: string, email: string, cls: string, gender: 'M' | 'F' | '') => {
    if (!sessionKey) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/student/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_key: sessionKey, name, email, class: cls, gender: gender || null }),
      });
      if (res.ok || res.status === 201) {
        const { student: data, access_code } = await res.json();
        setStudent(data);
        setLastAccessCode(access_code || null);
        setAuthMode('edit');
      }
    } catch (err) {
      console.error('[useStudentProfile] Erro ao criar perfil:', err);
    } finally {
      setIsLoading(false);
    }
  }, [sessionKey]);

  const loginWithAccessCode = useCallback(async (accessCode: string) => {
    if (!sessionKey) return false;
    setIsLoading(true);
    try {
      const res = await fetch('/api/student/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_code: accessCode.trim().toUpperCase(), session_key: sessionKey }),
      });
      if (!res.ok) return false;
      const { student: data } = await res.json();
      setStudent(data);
      setLastAccessCode(null);
      setIsProfileOpen(false);
      return true;
    } catch {
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [sessionKey]);

  const recoverAccessCode = useCallback(async (email: string) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/student/recover-access-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      if (!res.ok) return null;
      const { access_code } = await res.json();
      return access_code || null;
    } catch {
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logoutStudent = useCallback(() => {
    setStudent(null);
    setLastAccessCode(null);
    const newKey = createSessionKey();
    persistSessionKey(newKey);
    setAuthMode('login');
    setIsDashboardOpen(false);
  }, [persistSessionKey]);

  const updateProfile = useCallback(async (updates: { name?: string; email?: string; class?: string; gender?: 'M' | 'F' | '' }) => {
    if (!sessionKey) return;
    try {
      const res = await fetch('/api/student/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_key: sessionKey, ...updates }),
      });
      if (res.ok) {
        const { student: data } = await res.json();
        setStudent(data);
      }
    } catch (err) {
      console.error('[useStudentProfile] Erro ao actualizar perfil:', err);
    }
  }, [sessionKey]);

  /**
   * Salva resultado do quiz com respostas individuais.
   * questions + answers são usados para construir o payload detalhado.
   */
  const saveQuizResult = useCallback(async (
    score: number,
    totalQuestions: number,
    percentage: number,
    repoFullName?: string,
    questions?: QuizQuestion[],
    answers?: (number | null)[],
  ) => {
    if (!sessionKey || !student) return null;

    // Monta payload de respostas individuais
    const answersPayload = questions && answers
      ? questions.map((q, idx) => ({
          question_text:  q.question,
          options:        q.options,
          correct_index:  q.correctIndex,
          selected_index: answers[idx] ?? null,
          is_correct:     answers[idx] === q.correctIndex,
          explanation:    q.explanation,
          source:         q.source,
        }))
      : [];

    try {
      const res = await fetch('/api/student/quiz-result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_key:     sessionKey,
          repo_full_name:  repoFullName || null,
          score,
          total_questions: totalQuestions,
          percentage,
          answers:         answersPayload,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setStudent(data.student);

        if (data.leveled_up) {
          setLevelUpInfo({ from: data.level_before, to: data.level_after, xp: data.xp_earned });
          setTimeout(() => setLevelUpInfo(null), 5000);
        }
        return data;
      }
    } catch (err) {
      console.error('[useStudentProfile] Erro ao salvar resultado:', err);
    }
    return null;
  }, [sessionKey, student]);

  /** Carrega histórico de quizzes do aluno (com respostas) */
  const loadQuizHistory = useCallback(async (repoFullName?: string) => {
    if (!sessionKey) return;
    setIsLoadingHistory(true);
    try {
      const params = new URLSearchParams({ session_key: sessionKey, limit: '30' });
      if (repoFullName) params.set('repo', repoFullName);
      const res = await fetch(`/api/student/quiz-result?${params}`);
      if (res.ok) {
        const { results } = await res.json();
        setQuizHistory(results || []);
      }
    } catch (err) {
      console.error('[useStudentProfile] Erro ao carregar histórico:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [sessionKey]);

  /** Carrega ranking global ou por repositório */
  const loadRanking = useCallback(async (cls?: string, repoFullName?: string) => {
    try {
      const params = new URLSearchParams({ limit: '20' });
      if (cls) params.set('class', cls);

      if (repoFullName) {
        params.set('repo', repoFullName);
        params.set('mode', 'repo');
        const res = await fetch(`/api/student/ranking?${params}`);
        if (res.ok) {
          const { ranking: data } = await res.json();
          setRepoRanking(data || []);
        }
      } else {
        const res = await fetch(`/api/student/ranking?${params}`);
        if (res.ok) {
          const { ranking: data } = await res.json();
          setRanking(data || []);
        }
      }
    } catch (err) {
      console.error('[useStudentProfile] Erro ao carregar ranking:', err);
    }
  }, []);

  const openSignup    = useCallback(() => { setAuthMode('signup'); setIsProfileOpen(true); }, []);
  const openLogin     = useCallback(() => { setAuthMode('login');  setIsProfileOpen(true); }, []);
  const openProfile   = useCallback(() => { setAuthMode(student ? 'edit' : 'signup'); setIsProfileOpen(true); }, [student]);
  const closeProfile  = useCallback(() => setIsProfileOpen(false), []);

  const openDashboard = useCallback(() => {
    setIsDashboardOpen(true);
    loadRanking(student?.class || undefined);
    loadQuizHistory();
  }, [student, loadRanking, loadQuizHistory]);

  const closeDashboard = useCallback(() => setIsDashboardOpen(false), []);

  return {
    student,
    sessionKey,
    isLoading,
    isProfileOpen,
    authMode,
    isDashboardOpen,
    ranking,
    repoRanking,
    quizHistory,
    isLoadingHistory,
    levelUpInfo,
    lastAccessCode,
    loadProfile,
    createProfile,
    loginWithAccessCode,
    recoverAccessCode,
    logoutStudent,
    updateProfile,
    saveQuizResult,
    loadRanking,
    loadQuizHistory,
    openSignup,
    openLogin,
    openProfile,
    closeProfile,
    openDashboard,
    closeDashboard,
  };
}
