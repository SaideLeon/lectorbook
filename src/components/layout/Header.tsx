import { useState, useRef } from 'react';
import { Settings, Upload, Key, Maximize, Minimize } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { LectorLogo } from '@/components/layout/LectorLogo';
import { useFullscreen } from '@/contexts/FullscreenContext';

interface HeaderProps {
  apiKeys: string[];
  keyIndex: number;
  onUploadKeys: (file: File) => Promise<number>;
  onLogoClick?: () => void;
}

export const Header = ({ apiKeys = [], keyIndex = 0, onUploadKeys, onLogoClick }: HeaderProps) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const { isFullscreen, toggleFullscreen } = useFullscreen();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const count = await onUploadKeys(file);
      setUploadStatus(`Sucesso! ${count} chaves carregadas.`);
      setTimeout(() => setUploadStatus(null), 3000);
    } catch (err) {
      setUploadStatus('Erro ao carregar chaves.');
      setTimeout(() => setUploadStatus(null), 3000);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <header className="border-b border-white/10 bg-[#0a0a0a]/50 backdrop-blur-md sticky top-0 z-50">
      <div className="w-full px-4 md:px-6 h-16 flex items-center justify-between">
        <button
          onClick={onLogoClick}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <LectorLogo className="w-8 h-8" />
          <span className="font-semibold text-base md:text-lg tracking-tight text-white truncate max-w-[120px] md:max-w-none">LectorBook</span>
        </button>

        <div className="flex items-center gap-4">
          <button
            onClick={toggleFullscreen}
            className="p-2 text-gray-400 hover:text-white transition-colors rounded-full hover:bg-white/5"
            title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
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
          <div className="space-y-2 p-3 rounded-lg border border-indigo-500/20 bg-indigo-500/5">
            <p className="text-sm font-medium text-indigo-300">Token do GitHub via .env</p>
            <p className="text-xs text-gray-400">
              O token do GitHub deve ser configurado apenas no servidor usando a variável
              <span className="font-mono text-gray-300"> GITHUB_TOKEN </span>
              no arquivo <span className="font-mono text-gray-300">.env</span>.
            </p>
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
