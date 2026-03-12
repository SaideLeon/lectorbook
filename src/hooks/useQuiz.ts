import { useState, useCallback, useMemo } from 'react';
import { QuizQuestion, QuizState } from '@/types';

async function fetchQuiz(
  files: { path: string; content: string }[],
  questionCount: number,
  apiKey?: string,
): Promise<{ questions: QuizQuestion[] }> {
  const res = await fetch('/api/ai/quiz', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contextFiles: files, questionCount, apiKey }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Erro ${res.status} ao gerar questionário.`);
  }

  return res.json();
}

export function useQuiz() {
  const [quizState, setQuizState] = useState<QuizState>('idle');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Derived state ──────────────────────────────────────────────────────────

  const currentQuestion = questions[currentIndex] ?? null;
  const isLastQuestion = currentIndex === questions.length - 1;

  const score = useMemo(
    () => answers.filter((a, i) => a !== null && a === questions[i]?.correctIndex).length,
    [answers, questions],
  );

  const percentage = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;

  const performanceLabel = useMemo(() => {
    if (percentage >= 90) return { text: 'Excelente!', emoji: '🏆', color: 'text-emerald-400' };
    if (percentage >= 70) return { text: 'Bom trabalho!', emoji: '🎯', color: 'text-blue-400' };
    if (percentage >= 50) return { text: 'Suficiente', emoji: '📚', color: 'text-amber-400' };
    return { text: 'Precisa melhorar', emoji: '💪', color: 'text-red-400' };
  }, [percentage]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const startQuiz = useCallback(
    async (
      files: { path: string; content: string }[],
      questionCount: number,
      apiKey?: string,
    ) => {
      setError(null);
      setQuizState('loading');
      setQuestions([]);
      setAnswers([]);
      setCurrentIndex(0);
      setSelectedAnswer(null);
      setIsAnswered(false);

      try {
        const { questions: generated } = await fetchQuiz(files, questionCount, apiKey);
        if (!generated || generated.length === 0) {
          throw new Error('Não foi possível gerar perguntas com o conteúdo disponível.');
        }
        setQuestions(generated);
        setAnswers(new Array(generated.length).fill(null));
        setQuizState('active');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro desconhecido ao gerar questionário.');
        setQuizState('idle');
      }
    },
    [],
  );

  const selectAnswer = useCallback(
    (optionIndex: number) => {
      if (isAnswered || quizState !== 'active') return;
      setSelectedAnswer(optionIndex);
      setIsAnswered(true);
      setAnswers((prev) => {
        const next = [...prev];
        next[currentIndex] = optionIndex;
        return next;
      });
    },
    [isAnswered, quizState, currentIndex],
  );

  const nextQuestion = useCallback(() => {
    if (!isAnswered) return;

    if (isLastQuestion) {
      setQuizState('finished');
      return;
    }

    setCurrentIndex((prev) => prev + 1);
    setSelectedAnswer(null);
    setIsAnswered(false);
  }, [isAnswered, isLastQuestion]);

  const restart = useCallback(() => {
    setQuizState('idle');
    setQuestions([]);
    setAnswers([]);
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setIsAnswered(false);
    setError(null);
  }, []);

  return {
    quizState,
    questions,
    currentIndex,
    currentQuestion,
    answers,
    selectedAnswer,
    isAnswered,
    isLastQuestion,
    score,
    percentage,
    performanceLabel,
    error,
    startQuiz,
    selectAnswer,
    nextQuestion,
    restart,
  };
}
