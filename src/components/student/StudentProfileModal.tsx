// src/components/student/StudentProfileModal.tsx
import { useEffect, useMemo, useState } from 'react';
import { LogIn, UserPlus, Save, Loader2, KeyRound } from 'lucide-react';
import { Student } from '@/types/student';
import { Modal } from '@/components/ui/Modal';
import { type StudentAuthMode } from '@/hooks/useStudentProfile';

interface StudentProfileModalProps {
  isOpen: boolean;
  mode: StudentAuthMode;
  onClose: () => void;
  onSignUp: (name: string, cls: string, gender: 'M' | 'F' | '') => Promise<void>;
  onLogin: (accessCode: string) => Promise<boolean>;
  onSaveEdit: (name: string, cls: string, gender: 'M' | 'F' | '') => Promise<void>;
  existingStudent?: Student | null;
  isLoading?: boolean;
  lastAccessCode?: string | null;
}

export function StudentProfileModal({
  isOpen,
  mode,
  onClose,
  onSignUp,
  onLogin,
  onSaveEdit,
  existingStudent,
  isLoading,
  lastAccessCode,
}: StudentProfileModalProps) {
  const [name, setName] = useState('');
  const [cls, setCls] = useState('');
  const [gender, setGender] = useState<'M' | 'F' | ''>('');
  const [accessCode, setAccessCode] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(existingStudent?.name || '');
    setCls(existingStudent?.class || '');
    setGender(existingStudent?.gender || '');
    setErrorMsg(null);
  }, [existingStudent, mode, isOpen]);

  const title = useMemo(() => {
    if (mode === 'login') return 'Entrar';
    if (mode === 'edit') return 'Editar perfil';
    return 'Inscrever-se';
  }, [mode]);

  const handleSubmit = async () => {
    setSaving(true);
    setErrorMsg(null);
    try {
      if (mode === 'login') {
        const ok = await onLogin(accessCode);
        if (!ok) setErrorMsg('Código inválido. Verifique e tente novamente.');
        return;
      }

      if (!name.trim()) {
        setErrorMsg('Informe o nome do aluno.');
        return;
      }

      if (mode === 'edit') {
        await onSaveEdit(name.trim(), cls.trim(), gender);
      } else {
        await onSignUp(name.trim(), cls.trim(), gender);
      }
    } finally {
      setSaving(false);
    }
  };

  const busy = saving || isLoading;
  const buttonLabel = mode === 'login' ? 'Entrar' : mode === 'edit' ? 'Salvar alterações' : 'Inscrever aluno';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-4">
        {mode === 'login' ? (
          <div className="space-y-2">
            <label className="text-xs text-gray-400">Código de acesso</label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                placeholder="Ex: LB-AB12-CD34"
                className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-black/30 border border-white/10 text-sm outline-none focus:border-indigo-500"
              />
            </div>
            <p className="text-[11px] text-gray-500">Use o código recebido no cadastro para entrar em qualquer dispositivo.</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <label className="text-xs text-gray-400">Nome</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2.5 rounded-lg bg-black/30 border border-white/10 text-sm" />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-gray-400">Turma (opcional)</label>
              <input value={cls} onChange={(e) => setCls(e.target.value)} className="w-full px-3 py-2.5 rounded-lg bg-black/30 border border-white/10 text-sm" />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-gray-400">Gênero (opcional)</label>
              <select value={gender} onChange={(e) => setGender(e.target.value as any)} className="w-full px-3 py-2.5 rounded-lg bg-black/30 border border-white/10 text-sm">
                <option value="">Não informar</option>
                <option value="M">Masculino</option>
                <option value="F">Feminino</option>
              </select>
            </div>
          </>
        )}

        {lastAccessCode && mode !== 'login' && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
            <p className="text-xs text-emerald-300">Código de acesso criado:</p>
            <p className="font-mono text-sm text-emerald-200 mt-1">{lastAccessCode}</p>
          </div>
        )}

        {errorMsg && <p className="text-xs text-red-400">{errorMsg}</p>}

        <button
          onClick={handleSubmit}
          disabled={busy}
          className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : mode === 'login' ? <LogIn className="w-4 h-4" /> : mode === 'edit' ? <Save className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
          {buttonLabel}
        </button>
      </div>
    </Modal>
  );
}
