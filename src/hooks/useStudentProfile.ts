// src/hooks/useStudentProfile.ts
import { useState, useCallback, useEffect } from 'react';
import { Student, QuizResult, RankingEntry } from '@/types/student';

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
  const [student, setStudent] = useState<Student | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [authMode, setAuthMode] = useState<StudentAuthMode>('signup');
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [recentResults, setRecentResults] = useState<QuizResult[]>([]);
  const [levelUpInfo, setLevelUpInfo] = useState<{ from: string; to: string; xp: number } | null>(null);
  const [sessionKey, setSessionKey] = useState<string>(() => getOrCreateSessionKey());
  const [lastAccessCode, setLastAccessCode] = useState<string | null>(null);

  const persistSessionKey = useCallback((key: string) => {
    setSessionKey(key);
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
    } catch (err) {
      console.info('[useStudentProfile] Supabase não disponível.');
    } finally {
      setIsLoading(false);
    }
  }, [sessionKey]);

  const createProfile = useCallback(async (name: string, cls: string, gender: 'M' | 'F' | '') => {
    if (!sessionKey) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/student/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_key: sessionKey, name, class: cls, gender: gender || null }),
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
    } catch (err) {
      console.error('[useStudentProfile] Erro no login:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [sessionKey]);

  const logoutStudent = useCallback(() => {
    setStudent(null);
    setLastAccessCode(null);
    const newKey = createSessionKey();
    persistSessionKey(newKey);
    setAuthMode('login');
    setIsDashboardOpen(false);
  }, [persistSessionKey]);

  const updateProfile = useCallback(async (updates: { name?: string; class?: string; gender?: 'M' | 'F' | '' }) => {
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

  const saveQuizResult = useCallback(async (
    score: number,
    totalQuestions: number,
    percentage: number,
    repoFullName?: string,
  ) => {
    if (!sessionKey || !student) return null;
    try {
      const res = await fetch('/api/student/quiz-result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_key: sessionKey,
          repo_full_name: repoFullName || null,
          score,
          total_questions: totalQuestions,
          percentage,
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

  const loadRanking = useCallback(async (cls?: string) => {
    try {
      const params = cls ? `?class=${encodeURIComponent(cls)}` : '';
      const res = await fetch(`/api/student/ranking${params}`);
      if (res.ok) {
        const { ranking: data } = await res.json();
        setRanking(data);
      }
    } catch (err) {
      console.error('[useStudentProfile] Erro ao carregar ranking:', err);
    }
  }, []);

  const openSignup = useCallback(() => {
    setAuthMode('signup');
    setIsProfileOpen(true);
  }, []);
  const openLogin = useCallback(() => {
    setAuthMode('login');
    setIsProfileOpen(true);
  }, []);
  const openProfile = useCallback(() => {
    setAuthMode(student ? 'edit' : 'signup');
    setIsProfileOpen(true);
  }, [student]);
  const closeProfile = useCallback(() => setIsProfileOpen(false), []);
  const openDashboard = useCallback(() => { setIsDashboardOpen(true); loadRanking(student?.class || undefined); }, [student, loadRanking]);
  const closeDashboard = useCallback(() => setIsDashboardOpen(false), []);

  return {
    student,
    sessionKey,
    isLoading,
    isProfileOpen,
    authMode,
    isDashboardOpen,
    ranking,
    recentResults,
    levelUpInfo,
    lastAccessCode,
    loadProfile,
    createProfile,
    loginWithAccessCode,
    logoutStudent,
    updateProfile,
    saveQuizResult,
    loadRanking,
    openSignup,
    openLogin,
    openProfile,
    closeProfile,
    openDashboard,
    closeDashboard,
  };
}
