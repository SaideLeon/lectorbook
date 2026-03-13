import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  XCircle,
  ChevronRight,
  RotateCcw,
  MessageSquare,
  Loader2,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuiz } from '@/hooks/useQuiz';
import { QuizQuestion } from '@/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const OPTION_LABELS = ['A', 'B', 'C', 'D'];
const QUESTION_COUNTS = [5, 10, 15] as const;

function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = total > 0 ? ((current + 1) / total) * 100 : 0;
  return (
    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
      <motion.div
        className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full"
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      />
    </div>
  );
}

function ScoreCircle({ percentage }: { percentage: number }) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const dash = (percentage / 100) * circ;

  const color =
    percentage >= 90
      ? '#34d399'
      : percentage >= 70
      ? '#60a5fa'
      : percentage >= 50
      ? '#fbbf24'
      : '#f87171';

  return (
    <div className="relative w-36 h-36 flex items-center justify-center">
      <svg className="absolute inset-0 -rotate-90" width="144" height="144">
        <circle cx="72" cy="72" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
        <motion.circle
          cx="72"
          cy="72"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - dash }}
          transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
        />
      </svg>
      <motion.span
        className="text-3xl font-bold text-white"
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.5 }}
      >
        {percentage}%
      </motion.span>
    </div>
  );
}

// ─── Start Screen ─────────────────────────────────────────────────────────────

function StartScreen({
  files,
  hasAulasFilter,
  questionCount,
  onChangeCount,
  onStart,
  isLoading,
  error,
  onBack,
}: {
  files: { path: string; content: string }[];
  hasAulasFilter: boolean;
  questionCount: number;
  onChangeCount: (n: number) => void;
  onStart: () => void;
  isLoading: boolean;
  error: string | null;
  onBack: () => void;
}) {
  return (
    <motion.div
      key="start"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="flex flex-col h-full"
    >
      {/* Header */}
      <div className="p-3 md:p-4 border-b border-white/10 bg-[#151515] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-indigo-400" />
          <h3 className="font-medium text-sm">Testar Conhecimento</h3>
        </div>
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Voltar ao Chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {/* Info card */}
        <div className="bg-indigo-500/8 border border-indigo-500/20 rounded-xl p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center shrink-0 mt-0.5">
              <BookOpen className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">
                {hasAulasFilter
                  ? 'Questões baseadas no directório "aulas"'
                  : 'Questões baseadas nos documentos do repositório'}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                As perguntas serão geradas exclusivamente com base no conteúdo abaixo.
                Nenhuma informação externa será utilizada.
              </p>
            </div>
          </div>

          {/* File list */}
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {files.map((f) => (
              <div
                key={f.path}
                className="flex items-center gap-2 text-xs text-gray-400 py-1 px-2 rounded-lg bg-white/3 hover:bg-white/5"
              >
                <FileText className="w-3 h-3 text-indigo-400 shrink-0" />
                <span className="truncate">{f.path}</span>
              </div>
            ))}
          </div>

          {files.length === 0 && (
            <p className="text-xs text-amber-400 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              Nenhum ficheiro .md/.txt encontrado no directório "aulas".
            </p>
          )}
        </div>

        {/* Question count */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-300 uppercase tracking-wider">
            Número de perguntas
          </p>
          <div className="flex gap-2">
            {QUESTION_COUNTS.map((n) => (
              <button
                key={n}
                onClick={() => onChangeCount(n)}
                className={cn(
                  'flex-1 py-2.5 rounded-xl text-sm font-medium transition-all border',
                  questionCount === n
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                    : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white',
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Start button */}
        <button
          onClick={onStart}
          disabled={isLoading || files.length === 0}
          className={cn(
            'w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2',
            files.length > 0 && !isLoading
              ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
              : 'bg-white/5 text-gray-600 cursor-not-allowed',
          )}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              A gerar questionário com IA...
            </>
          ) : (
            <>
              <BookOpen className="w-4 h-4" />
              Iniciar Teste
            </>
          )}
        </button>

        <p className="text-[10px] text-gray-600 text-center leading-relaxed">
          A IA analisa os documentos e cria perguntas apenas sobre o que está
          explicitamente documentado. Tempo estimado de geração: 10–30 segundos.
        </p>
      </div>
    </motion.div>
  );
}

// ─── Question Screen ──────────────────────────────────────────────────────────

function QuestionScreen({
  question,
  index,
  total,
  selectedAnswer,
  isAnswered,
  onSelect,
  onNext,
  isLast,
}: {
  question: QuizQuestion;
  index: number;
  total: number;
  selectedAnswer: number | null;
  isAnswered: boolean;
  onSelect: (i: number) => void;
  onNext: () => void;
  isLast: boolean;
}) {
  return (
    <motion.div
      key={`question-${index}`}
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -24 }}
      transition={{ duration: 0.25 }}
      className="flex flex-col h-full"
    >
      {/* Header */}
      <div className="p-3 md:p-4 border-b border-white/10 bg-[#151515] space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">
            Pergunta{' '}
            <span className="text-white font-medium">{index + 1}</span>
            {' '}de{' '}
            <span className="text-white font-medium">{total}</span>
          </span>
          <span className="text-xs text-indigo-400 font-medium">
            {Math.round(((index + 1) / total) * 100)}%
          </span>
        </div>
        <ProgressBar current={index} total={total} />
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Question */}
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-indigo-400">
            {question.source && <span className="font-mono">{question.source.split('/').pop()}</span>}
          </p>
          <p className="text-base font-medium text-white leading-relaxed">
            {question.question}
          </p>
        </div>

        {/* Options */}
        <div className="space-y-2.5">
          {question.options.map((option, i) => {
            const isSelected = selectedAnswer === i;
            const isCorrect = i === question.correctIndex;
            const showResult = isAnswered;

            let style = 'bg-white/5 border-white/10 text-gray-200 hover:bg-white/10 hover:border-white/20';
            if (showResult) {
              if (isCorrect) {
                style = 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300';
              } else if (isSelected && !isCorrect) {
                style = 'bg-red-500/15 border-red-500/50 text-red-300';
              } else {
                style = 'bg-white/3 border-white/5 text-gray-500 cursor-default';
              }
            }

            return (
              <motion.button
                key={i}
                onClick={() => !isAnswered && onSelect(i)}
                disabled={isAnswered}
                whileTap={!isAnswered ? { scale: 0.98 } : undefined}
                className={cn(
                  'w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-200 text-sm',
                  style,
                  !isAnswered && 'cursor-pointer',
                  isAnswered && 'cursor-default',
                )}
              >
                {/* Label badge */}
                <span
                  className={cn(
                    'w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 transition-all',
                    showResult && isCorrect
                      ? 'bg-emerald-500/30 text-emerald-300'
                      : showResult && isSelected && !isCorrect
                      ? 'bg-red-500/30 text-red-300'
                      : isSelected && !showResult
                      ? 'bg-indigo-500/40 text-indigo-300'
                      : 'bg-white/8 text-gray-400',
                  )}
                >
                  {OPTION_LABELS[i]}
                </span>

                <span className="flex-1 leading-relaxed">{option}</span>

                {showResult && isCorrect && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                )}
                {showResult && isSelected && !isCorrect && (
                  <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Explanation */}
        <AnimatePresence>
          {isAnswered && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={cn(
                'rounded-xl p-4 border text-xs leading-relaxed space-y-1',
                selectedAnswer === question.correctIndex
                  ? 'bg-emerald-500/8 border-emerald-500/25 text-emerald-300'
                  : 'bg-amber-500/8 border-amber-500/25 text-amber-200',
              )}
            >
              <p className="font-semibold text-[10px] uppercase tracking-wider opacity-70">
                {selectedAnswer === question.correctIndex ? '✓ Correcto' : '✗ Incorrecte — Explicação'}
              </p>
              <p>{question.explanation}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Next button */}
      {isAnswered && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 border-t border-white/10 bg-[#151515]"
        >
          <button
            onClick={onNext}
            className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20"
          >
            {isLast ? 'Ver Resultados' : 'Próxima Pergunta'}
            <ChevronRight className="w-4 h-4" />
          </button>
        </motion.div>
      )}
    </motion.div>
  );
}

// ─── Results Screen ───────────────────────────────────────────────────────────

function ResultsScreen({
  questions,
  answers,
  score,
  percentage,
  performanceLabel,
  onRestart,
  onBackToChat,
}: {
  questions: QuizQuestion[];
  answers: (number | null)[];
  score: number;
  percentage: number;
  performanceLabel: { text: string; emoji: string; color: string };
  onRestart: () => void;
  onBackToChat: () => void;
}) {
  return (
    <motion.div
      key="results"
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col h-full"
    >
      {/* Header */}
      <div className="p-3 md:p-4 border-b border-white/10 bg-[#151515] flex items-center justify-between">
        <h3 className="font-medium text-sm flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-indigo-400" />
          Resultados do Teste
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Score hero */}
        <div className="flex flex-col items-center py-8 px-5 gap-4 border-b border-white/8">
          <ScoreCircle percentage={percentage} />
          <div className="text-center space-y-1">
            <p className={cn('text-xl font-bold', performanceLabel.color)}>
              {performanceLabel.emoji} {performanceLabel.text}
            </p>
            <p className="text-sm text-gray-400">
              <span className="text-white font-semibold">{score}</span> de{' '}
              <span className="text-white font-semibold">{questions.length}</span> perguntas corretas
            </p>
          </div>
        </div>

        {/* Question breakdown */}
        <div className="p-4 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-3">
            Detalhe por pergunta
          </p>
          {questions.map((q, i) => {
            const selected = answers[i];
            const correct = selected === q.correctIndex;
            return (
              <motion.div
                key={q.id}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className={cn(
                  'rounded-xl border p-3 space-y-2 text-xs',
                  correct
                    ? 'bg-emerald-500/6 border-emerald-500/20'
                    : 'bg-red-500/6 border-red-500/20',
                )}
              >
                <div className="flex items-start gap-2">
                  {correct ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  )}
                  <p className={cn('font-medium leading-relaxed', correct ? 'text-gray-200' : 'text-gray-300')}>
                    {i + 1}. {q.question}
                  </p>
                </div>
                {!correct && (
                  <div className="pl-6 space-y-1">
                    {selected !== null && (
                      <p className="text-red-400">
                        Sua resposta: <span className="font-medium">{q.options[selected]}</span>
                      </p>
                    )}
                    <p className="text-emerald-400">
                      Resposta correcta: <span className="font-medium">{q.options[q.correctIndex]}</span>
                    </p>
                    <p className="text-gray-500 leading-relaxed">{q.explanation}</p>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="p-4 flex gap-3 border-t border-white/8">
          <button
            onClick={onRestart}
            className="flex-1 py-2.5 rounded-xl bg-white/8 hover:bg-white/12 border border-white/10 text-gray-200 text-sm font-medium transition-all flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Refazer
          </button>
          <button
            onClick={onBackToChat}
            className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20"
          >
            <MessageSquare className="w-4 h-4" />
            Ir ao Chat
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface QuizInterfaceProps {
  allFiles: { path: string; content: string }[];
  apiKey?: string;
  onBack: () => void;
  /** Called once when the quiz finishes, before the results screen is shown. */
  onQuizFinished?: (score: number, total: number, percentage: number) => void;
}

export function QuizInterface({ allFiles, apiKey, onBack, onQuizFinished }: QuizInterfaceProps) {
  const [questionCount, setQuestionCount] = useState<number>(10);

  const {
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
  } = useQuiz();

  // Filter to "aulas" directory first; fall back to all teaching docs
  const aulasFiles = (() => {
    const filtered = allFiles.filter(
      (f) =>
        f.path.toLowerCase().includes('/aulas/') ||
        f.path.toLowerCase().startsWith('aulas/') ||
        f.path.toLowerCase().includes('/lessons/') ||
        f.path.toLowerCase().includes('/modulos/') ||
        f.path.toLowerCase().includes('/materiais/'),
    );
    return filtered.length > 0 ? filtered : allFiles;
  })();

  const hasAulasFilter = aulasFiles.length < allFiles.length || allFiles.some(
    (f) =>
      f.path.toLowerCase().includes('/aulas/') ||
      f.path.toLowerCase().startsWith('aulas/'),
  );

  const handleStart = () => {
    startQuiz(aulasFiles, questionCount, apiKey);
  };

  /**
   * Wrapper around nextQuestion that fires onQuizFinished when advancing
   * past the last question, so the parent (App.tsx) can save the XP result
   * before the results screen appears.
   */
  const handleNext = useCallback(() => {
    if (isLastQuestion) {
      onQuizFinished?.(score, questions.length, percentage);
    }
    nextQuestion();
  }, [isLastQuestion, onQuizFinished, score, questions.length, percentage, nextQuestion]);

  return (
    <div className="flex flex-col bg-[#111] rounded-xl border border-white/10 overflow-hidden h-[96%]">
      <AnimatePresence mode="wait">
        {quizState === 'idle' || quizState === 'loading' ? (
          <StartScreen
            key="start"
            files={aulasFiles}
            hasAulasFilter={hasAulasFilter}
            questionCount={questionCount}
            onChangeCount={setQuestionCount}
            onStart={handleStart}
            isLoading={quizState === 'loading'}
            error={error}
            onBack={onBack}
          />
        ) : quizState === 'active' && currentQuestion ? (
          <QuestionScreen
            key={`q-${currentIndex}`}
            question={currentQuestion}
            index={currentIndex}
            total={questions.length}
            selectedAnswer={selectedAnswer}
            isAnswered={isAnswered}
            onSelect={selectAnswer}
            onNext={handleNext}
            isLast={isLastQuestion}
          />
        ) : quizState === 'finished' ? (
          <ResultsScreen
            key="results"
            questions={questions}
            answers={answers}
            score={score}
            percentage={percentage}
            performanceLabel={performanceLabel}
            onRestart={restart}
            onBackToChat={onBack}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}
