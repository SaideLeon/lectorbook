// src/components/student/LevelBadge.tsx
import { cn } from '@/lib/utils';
import { StudentLevel, LEVEL_META, getXpProgress } from '@/types/student';

interface LevelBadgeProps {
  level: StudentLevel;
  xp: number;
  size?: 'sm' | 'md' | 'lg';
  showProgress?: boolean;
  showXp?: boolean;
  className?: string;
}

export function LevelBadge({ level, xp, size = 'md', showProgress = false, showXp = false, className }: LevelBadgeProps) {
  const meta = LEVEL_META[level];
  const progress = getXpProgress(xp);

  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5 gap-1',
    md: 'text-xs px-2 py-1 gap-1.5',
    lg: 'text-sm px-3 py-1.5 gap-2',
  };

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className={cn(
        'inline-flex items-center rounded-full border font-semibold',
        meta.bg, meta.border, meta.color,
        sizeClasses[size],
      )}>
        <span>{meta.emoji}</span>
        <span>{meta.label}</span>
        {showXp && <span className="opacity-60 font-normal">· {xp} XP</span>}
      </div>

      {showProgress && (
        <div className="space-y-0.5">
          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-700', {
                'bg-amber-600': level === 'bronze',
                'bg-slate-300': level === 'prata',
                'bg-yellow-400': level === 'ouro',
                'bg-violet-500': level === 'epico',
                'bg-rose-400': level === 'lendario',
              })}
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
          {progress.nextLevel && (
            <p className="text-[9px] text-gray-500">
              {xp} / {progress.next} XP para {LEVEL_META[progress.nextLevel].label}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
