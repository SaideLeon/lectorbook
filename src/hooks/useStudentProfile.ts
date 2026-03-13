// src/hooks/useStudentProfile.ts
import { useState, useCallback, useEffect } from 'react';
import { Student, QuizResult, RankingEntry } from '@/types/student';

const SESSION_KEY_STORAGE = 'lectorbook-student-session';

function getOrCreateSessionKey(): string {
  if (typeof window === 'undefined') return '';
  let key = localStorage.getItem(SESSION_KEY_STORAGE);
  if (!key) {
    key = `sk_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(SESSION_KEY_STORAGE, key);
  }
  return key;
}

function isSupabaseAvailable(): boolean {
  // We'll try and handle errors gracefully
  return true;
}

export function useStudentProfile() {
  const [student, setStudent] = useState<Student | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [recentResults, setRecentResults] = useState<QuizResult[]>([]);
  const [levelUpInfo, setLevelUpInfo] = useState<{ from: string; to: string; xp: number } | null>(null);
  const [sessionKey] = useState<string>(() => getOrCreateSessionKey());

  // Load profile on mount
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
        // Show profile setup if new user
        if (!data) setIsProfileOpen(true);
      }
    } catch (err) {
      // Supabase not configured — silent fail, features disabled
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
        const { student: data } = await res.json();
        setStudent(data);
        setIsProfileOpen(false);
      }
    } catch (err) {
      console.error('[useStudentProfile] Erro ao criar perfil:', err);
    } finally {
      setIsLoading(false);
    }
  }, [sessionKey]);

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

  const openProfile = useCallback(() => setIsProfileOpen(true), []);
  const closeProfile = useCallback(() => setIsProfileOpen(false), []);
  const openDashboard = useCallback(() => { setIsDashboardOpen(true); loadRanking(student?.class || undefined); }, [student, loadRanking]);
  const closeDashboard = useCallback(() => setIsDashboardOpen(false), []);

  return {
    student,
    sessionKey,
    isLoading,
    isProfileOpen,
    isDashboardOpen,
    ranking,
    recentResults,
    levelUpInfo,
    loadProfile,
    createProfile,
    updateProfile,
    saveQuizResult,
    loadRanking,
    openProfile,
    closeProfile,
    openDashboard,
    closeDashboard,
  };
}
