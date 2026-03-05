import { useState, useRef, useEffect } from 'react';
import { Code2, Settings, Upload, Key, Maximize, Minimize, Github } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';

interface HeaderProps {
  apiKeys: string[];
  keyIndex: number;
  onUploadKeys: (file: File) => Promise<number>;
  onLogoClick?: () => void;
}

export const Header = ({ apiKeys = [], keyIndex = 0, onUploadKeys, onLogoClick }: HeaderProps) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [githubToken, setGithubToken] = useState('');

  const [githubStatus, setGithubStatus] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('github_token');
    if (token) setGithubToken(token);

    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const formatApiError = async (res: Response, fallbackMessage: string) => {
    try {
      const data = await res.json();
      const baseMessage = data.error || fallbackMessage;
      const details = data.details ? ` | detalhes: ${JSON.stringify(data.details)}` : '';
      const debugId = data.debugId ? ` | debugId: ${data.debugId}` : '';
      return `${baseMessage}${details}${debugId}`;
    } catch {
      return `${fallbackMessage} (${res.status} ${res.statusText})`;
    }
  };

  const handleSaveToken = async () => {
    if (githubToken.trim()) {
      const token = githubToken.trim();
      localStorage.setItem('github_token', token);

      try {
        setGithubStatus('Validando token...');
        const res = await fetch('/api/github/repos', {
          headers: { 'x-github-token': token }
        });

        if (res.ok) {
          setGithubStatus('Sucesso! Conectado ao GitHub.');
          window.dispatchEvent(new Event('github_token_updated'));
        } else {
          const errorMessage = await formatApiError(res, 'Erro ao validar token GitHub');
          setGithubStatus(`Erro: ${errorMessage}`);
        }
      } catch (err) {
        setGithubStatus(`Erro ao conectar com GitHub: ${err instanceof Error ? err.message : 'erro desconhecido'}`);
      }
      setTimeout(() => setGithubStatus(null), 7000);
    } else {
      localStorage.removeItem('github_token');
      setGithubStatus('Token removido.');
      setTimeout(() => setGithubStatus(null), 3000);
    }
  };

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
      }
    } catch (err) {
      console.error("Erro ao alternar tela cheia:", err);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const count = await onUploadKeys(file);
      setUploadStatus(`Sucesso! ${count} chaves carregadas.`);
      setTimeout(() => setUploadStatus(null), 3000);
    } catch (err) {
      setUploadStatus("Erro ao carregar chaves.");
      setTimeout(() => setUploadStatus(null), 3000);
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleConnectGithub = async () => {
    try {
      const res = await fetch('/api/github/auth/url');
      if (!res.ok) {
        const errorMessage = await formatApiError(res, 'Falha ao obter URL de autenticação GitHub');
        throw new Error(errorMessage);
      }

      const { url } = await res.json();

      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      window.open(
        url,
        'github_auth',
        `width=${width},height=${height},left=${left},top=${top}`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'erro desconhecido';
      setGithubStatus(`Erro OAuth: ${message}`);
      console.error('Erro ao conectar GitHub:', err);
    }
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'GITHUB_AUTH_SUCCESS') {
        const token = event.data.token;
        localStorage.setItem('github_token', token);
        setGithubToken(token);
        // Trigger a custom event or state update to refresh repos
        window.dispatchEvent(new Event('github_token_updated'));
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return (
    <header className="border-b border-white/10 bg-[#0a0a0a]/50 backdrop-blur-md sticky top-0 z-50">
      <div className="w-full px-4 md:px-6 h-16 flex items-center justify-between">
        <button 
          onClick={onLogoClick}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center shrink-0">
            <Code2 className="text-white w-5 h-5" />
          </div>
          <span className="font-semibold text-base md:text-lg tracking-tight text-white truncate max-w-[120px] md:max-w-none">Brada Iota</span>
        </button>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={toggleFullscreen}
            className="p-2 text-gray-400 hover:text-white transition-colors rounded-full hover:bg-white/5"
            title={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
          >
            {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
          </button>

          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="relative p-2 text-gray-400 hover:text-white transition-colors rounded-full hover:bg-white/5"
            title="Gerenciar Chaves API"
          >
            <Settings className="w-5 h-5" />
            {apiKeys.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-emerald-500 rounded-full border border-[#0a0a0a]" />
            )}
          </button>
          <span className="text-sm text-gray-500">v1.0.0</span>
        </div>
      </div>

      <Modal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        title="Gerenciar Chaves API"
      >
        <div className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-300">GitHub Token (Opcional)</label>
              <button 
                onClick={handleConnectGithub}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 px-2 py-1 bg-indigo-500/10 rounded-md border border-indigo-500/20 transition-colors"
              >
                <Github className="w-3 h-3" />
                Conectar via OAuth
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="password"
                value={githubToken}
                onChange={(e) => setGithubToken(e.target.value)}
                placeholder="ghp_..."
                className="flex-1 bg-[#111] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <button
                onClick={handleSaveToken}
                className="bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-lg text-sm transition-colors"
              >
                Salvar
              </button>
            </div>
            <p className="text-xs text-gray-500">
              Adicione seu token pessoal para aumentar os limites de taxa da API e acessar repositórios privados.
            </p>
            {githubStatus && (
              <p className={`text-xs ${githubStatus.includes('Erro') ? 'text-red-400' : 'text-emerald-400'}`}>
                {githubStatus}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">Carregar arquivo de chaves (.txt)</label>
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-white/10 rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-500/50 hover:bg-white/5 transition-all group"
            >
              <Upload className="w-8 h-8 text-gray-500 group-hover:text-indigo-400 mb-2 transition-colors" />
              <span className="text-sm text-gray-400 group-hover:text-gray-300">Clique para selecionar arquivo</span>
              <span className="text-xs text-gray-600 mt-1">Uma chave por linha</span>
            </div>
            <input 
              type="file" 
              accept=".txt" 
              ref={fileInputRef} 
              onChange={handleFileChange}
              className="hidden"
            />
            {uploadStatus && (
              <p className={`text-xs ${uploadStatus.includes('Erro') ? 'text-red-400' : 'text-emerald-400'}`}>
                {uploadStatus}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-300">Chaves Carregadas</label>
              <span className="text-xs text-gray-500">{apiKeys.length} chaves</span>
            </div>
            
            <div className="bg-[#111] rounded-lg border border-white/5 max-h-48 overflow-y-auto">
              {apiKeys.length === 0 ? (
                <div className="p-4 text-center text-xs text-gray-600 italic">
                  Nenhuma chave carregada. Usando chave padrão do sistema.
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {apiKeys.map((key, i) => (
                    <div key={i} className={`px-3 py-2 flex items-center justify-between text-xs ${i === keyIndex ? 'bg-indigo-500/10' : ''}`}>
                      <div className="flex items-center gap-2">
                        <Key className={`w-3 h-3 ${i === keyIndex ? 'text-indigo-400' : 'text-gray-600'}`} />
                        <span className="font-mono text-gray-400">
                          {key.substring(0, 8)}...{key.substring(key.length - 4)}
                        </span>
                      </div>
                      {i === keyIndex && (
                        <span className="text-[10px] font-medium bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded">
                          ATIVA
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </Modal>
    </header>
  );
};
