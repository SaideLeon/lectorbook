// src/components/student/StudentButton.tsx
import { User, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Student, LEVEL_META } from '@/types/student';
import { LevelBadge } from './LevelBadge';

interface StudentButtonProps {
  student: Student | null;
  isLoading?: boolean;
  onOpenDashboard: () => void;
  onOpenProfile: () => void;
}

export function StudentButton({ student, isLoading, onOpenDashboard, onOpenProfile }: StudentButtonProps) {
  if (isLoading) return null;

  if (!student) {
    return (
      <button
        onClick={onOpenProfile}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 text-xs font-medium transition-all hover:scale-105"
        title="Criar perfil de aluno"
      >
        <User className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Criar Perfil</span>
      </button>
    );
  }

  const meta = LEVEL_META[student.level];

  return (
    <button
      onClick={onOpenDashboard}
      className={cn(
        'flex items-center gap-2 px-2.5 py-1.5 rounded-xl border transition-all hover:scale-105',
        meta.bg, meta.border,
      )}
      title={`${student.name} · ${student.total_xp} XP · Nível ${meta.label}`}
    >
      <span className="text-sm">{meta.emoji}</span>
      <div className="hidden sm:flex flex-col items-start">
        <span className={cn('text-[10px] font-semibold leading-tight', meta.color)}>
          {student.name.split(' ')[0]}
        </span>
        <span className="text-[9px] text-gray-500">{student.total_xp} XP</span>
      </div>
    </button>
  );
}
