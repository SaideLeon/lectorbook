// src/components/student/StudentProfileModal.tsx
import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, GraduationCap, Users, Check, X, Edit2, Loader2 } from 'lucide-react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { Student, LEVEL_META } from '@/types/student';
import { LevelBadge } from './LevelBadge';

interface StudentProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, cls: string, gender: 'M' | 'F' | '') => Promise<void>;
  existingStudent?: Student | null;
  isLoading?: boolean;
}

const GENDER_OPTIONS = [
  { value: 'M' as const, label: 'Masculino', emoji: '👨' },
  { value: 'F' as const, label: 'Feminino',  emoji: '👩' },
];

export function StudentProfileModal({ isOpen, onClose, onSave, existingStudent, isLoading }: StudentProfileModalProps) {
  const [name, setName] = useState(existingStudent?.name || '');
  const [cls, setCls] = useState(existingStudent?.class || '');
  const [gender, setGender] = useState<'M' | 'F' | ''>(existingStudent?.gender || '');
  const [saving, setSaving] = useState(false);

  const isNew = !existingStudent;

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave(name.trim(), cls.trim(), gender);
    } finally {
      setSaving(false);
    }
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={isNew ? undefined : onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[110]"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, x: '-50%', y: '-44%' }}
            animate={{ opacity: 1, scale: 1,    x: '-50%', y: '-50%' }}
            exit={{ opacity: 0, scale: 0.94,    x: '-50%', y: '-44%' }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="fixed left-1/2 top-1/2 w-full max-w-md z-[111] bg-[#111] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Header gradient */}
            <div className="relative h-24 bg-gradient-to-br from-indigo-600/40 via-violet-600/30 to-transparent overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(99,102,241,0.3),transparent_60%)]" />
              <div className="absolute bottom-0 left-0 right-0 h-px bg-white/10" />

              {/* Avatar */}
              <div className="absolute bottom-0 translate-y-1/2 left-5">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-xl border-2 border-[#111]">
                  <User className="w-7 h-7 text-white" />
                </div>
              </div>

              {!isNew && (
                <button onClick={onClose} className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="pt-10 px-5 pb-5 space-y-4">
              {/* Title */}
              <div>
                <h2 className="text-lg font-semibold text-white">
                  {isNew ? '👋 Bem-vindo ao LectorBook!' : 'Editar Perfil'}
                </h2>
                {isNew && (
                  <p className="text-xs text-gray-400 mt-1">
                    Cria o teu perfil para acompanhar o teu progresso e subir de nível.
                  </p>
                )}
                {existingStudent && !isNew && (
                  <div className="mt-2">
                    <LevelBadge level={existingStudent.level} xp={existingStudent.total_xp} showProgress showXp />
                  </div>
                )}
              </div>

              {/* Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Nome completo *
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="O teu nome..."
                    className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/20 transition-all"
                  />
                </div>
              </div>

              {/* Class */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Turma
                </label>
                <div className="relative">
                  <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    value={cls}
                    onChange={e => setCls(e.target.value)}
                    placeholder="Ex: CV3-A"
                    className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/20 transition-all"
                  />
                </div>
              </div>

              {/* Gender */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider flex items-center gap-2">
                  <Users className="w-3.5 h-3.5" />
                  Género
                </label>
                <div className="flex gap-2">
                  {GENDER_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setGender(prev => prev === opt.value ? '' : opt.value)}
                      className={cn(
                        'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-all',
                        gender === opt.value
                          ? 'bg-indigo-600/20 border-indigo-500/60 text-indigo-300'
                          : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white',
                      )}
                    >
                      <span>{opt.emoji}</span>
                      <span>{opt.label}</span>
                      {gender === opt.value && <Check className="w-3.5 h-3.5" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Levels preview (only for new users) */}
              {isNew && (
                <div className="bg-white/3 border border-white/8 rounded-xl p-3">
                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Sistema de Níveis</p>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(LEVEL_META).map(([key, meta]) => (
                      <span key={key} className={cn('text-xs px-2 py-0.5 rounded-full border', meta.bg, meta.border, meta.color)}>
                        {meta.emoji} {meta.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                {!isNew && (
                  <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white text-sm font-medium transition-colors">
                    Cancelar
                  </button>
                )}
                <button
                  onClick={handleSave}
                  disabled={!name.trim() || saving}
                  className={cn(
                    'flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2',
                    name.trim() && !saving
                      ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                      : 'bg-white/5 text-gray-600 cursor-not-allowed',
                  )}
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {isNew ? 'Criar Perfil' : 'Guardar'}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
