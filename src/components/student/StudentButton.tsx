// src/components/student/StudentButton.tsx
import { UserPlus, LogIn } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Student, LEVEL_META } from '@/types/student';

interface StudentButtonProps {
  student: Student | null;
  isLoading?: boolean;
  onOpenDashboard: () => void;
  onOpenProfile: () => void;
  onOpenLogin: () => void;
}

export function StudentButton({ student, isLoading, onOpenDashboard, onOpenProfile, onOpenLogin }: StudentButtonProps) {
  if (isLoading) return null;

  if (!student) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenLogin}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 text-xs font-medium transition-all"
          title="Entrar"
        >
          <LogIn className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Entrar</span>
        </button>
        <button
          onClick={onOpenProfile}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 text-xs font-medium transition-all"
          title="Inscrever-se"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Inscrever-se</span>
        </button>
      </div>
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
