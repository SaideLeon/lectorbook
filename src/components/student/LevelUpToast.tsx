// src/components/student/LevelUpToast.tsx
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { LEVEL_META, StudentLevel } from '@/types/student';

interface LevelUpToastProps {
  from: StudentLevel;
  to: StudentLevel;
  xp: number;
  onDismiss: () => void;
}

export function LevelUpToast({ from, to, xp, onDismiss }: LevelUpToastProps) {
  const toMeta = LEVEL_META[to];

  return (
    <motion.div
      initial={{ opacity: 0, y: 80, scale: 0.85 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 40, scale: 0.9 }}
      transition={{ type: 'spring', damping: 20, stiffness: 180 }}
      onClick={onDismiss}
      className={cn(
        'fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-[200] cursor-pointer',
        'min-w-[280px] max-w-xs',
      )}
    >
      <div className={cn(
        'relative overflow-hidden rounded-2xl border-2 shadow-2xl p-4',
        toMeta.bg, toMeta.border,
      )}>
        {/* Shimmer effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -skew-x-12 animate-pulse" />

        <div className="relative flex items-center gap-3">
          <div className="text-4xl">{toMeta.emoji}</div>
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-widest font-medium">Subida de Nível!</p>
            <p className={cn('text-lg font-black', toMeta.color)}>{toMeta.label}</p>
            <p className="text-xs text-gray-400">+{xp} XP ganhos neste teste 🎉</p>
          </div>
        </div>
        <p className="text-center text-[9px] text-gray-600 mt-2">Toca para fechar</p>
      </div>
    </motion.div>
  );
}
