import { useState } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
import { PersonalRepoConfig } from '@/types';

interface PersonalLibrarySettingsProps {
  isConnected: boolean;
  repoConfig: PersonalRepoConfig | null;
  onConnect: (pat: string, owner: string, repo: string, branch?: string) => Promise<void>;
  onDisconnect: () => void;
}

export function PersonalLibrarySettings({ isConnected, repoConfig, onConnect, onDisconnect }: PersonalLibrarySettingsProps) {
  const [pat, setPat] = useState('');
  const [owner, setOwner] = useState(repoConfig?.owner ?? '');
  const [repo, setRepo] = useState(repoConfig?.repo ?? '');
  const [branch, setBranch] = useState(repoConfig?.branch ?? 'main');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = async () => {
    setIsConnecting(true);
    setFeedback(null);

    try {
      await onConnect(pat, owner, repo, branch);
      setFeedback({ type: 'success', message: 'Biblioteca pessoal conectada com sucesso.' });
      setPat('');
    } catch (error) {
      setFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Falha ao conectar biblioteca pessoal.' });
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="mt-6 border-t border-white/10 pt-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-200">Biblioteca Pessoal GitHub</h3>
        <a
          href="https://github.com/settings/tokens"
          target="_blank"
          rel="noreferrer"
          className="text-xs text-indigo-300 hover:text-indigo-200 inline-flex items-center gap-1"
        >
          Criar PAT
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {isConnected && repoConfig ? (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 flex items-center justify-between gap-3">
          <div className="text-xs text-emerald-200">
            <p className="font-medium">Conectado em {repoConfig.owner}/{repoConfig.repo}</p>
            <p className="text-emerald-300/90">Branch: {repoConfig.branch}</p>
          </div>
          <button onClick={onDisconnect} className="text-xs px-3 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-100">
            Desconectar
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <input type="password" placeholder="Personal Access Token" value={pat} onChange={(e) => setPat(e.target.value)} className="w-full bg-[#111] border border-white/10 rounded-lg px-3 py-2 text-xs text-gray-100" />
          <div className="grid grid-cols-2 gap-2">
            <input type="text" placeholder="Owner" value={owner} onChange={(e) => setOwner(e.target.value)} className="bg-[#111] border border-white/10 rounded-lg px-3 py-2 text-xs text-gray-100" />
            <input type="text" placeholder="Repositório" value={repo} onChange={(e) => setRepo(e.target.value)} className="bg-[#111] border border-white/10 rounded-lg px-3 py-2 text-xs text-gray-100" />
          </div>
          <input type="text" placeholder="Branch (main)" value={branch} onChange={(e) => setBranch(e.target.value)} className="w-full bg-[#111] border border-white/10 rounded-lg px-3 py-2 text-xs text-gray-100" />
          <button disabled={isConnecting} onClick={handleConnect} className="w-full text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg py-2 flex items-center justify-center gap-2">
            {isConnecting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Conectar
          </button>
        </div>
      )}

      {feedback && <p className={`text-xs ${feedback.type === 'error' ? 'text-red-400' : 'text-emerald-400'}`}>{feedback.message}</p>}
    </div>
  );
}
