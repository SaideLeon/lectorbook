import { useState, useRef, useEffect } from 'react';
import { BookOpen, Settings, Upload, Maximize, Minimize } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';

interface HeaderProps {
  apiKeys: string[];
  keyIndex: number;
  onUploadKeys: (file: File) => Promise<number>;
  onLogoClick?: () => void;
  language: 'pt-BR' | 'EN' | 'ES';
  onLanguageChange: (language: 'pt-BR' | 'EN' | 'ES') => void;
}

export const Header = ({ apiKeys = [], onUploadKeys, onLogoClick, language, onLanguageChange }: HeaderProps) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    else await document.exitFullscreen();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const count = await onUploadKeys(file);
      setUploadStatus(`Sucesso! ${count} chaves carregadas.`);
    } catch {
      setUploadStatus('Erro ao carregar chaves.');
    }
    setTimeout(() => setUploadStatus(null), 3000);
  };

  return (
    <header className="border-b border-white/10 bg-[#0a0a0a]/50 backdrop-blur-md sticky top-0 z-50">
      <div className="w-full px-4 md:px-6 h-16 flex items-center justify-between">
        <button onClick={onLogoClick} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center shrink-0"><BookOpen className="text-white w-5 h-5" /></div>
          <span className="font-semibold text-base md:text-lg tracking-tight text-white">Lectorbook</span>
        </button>

        <div className="flex items-center gap-4">
          <select value={language} onChange={(e) => onLanguageChange(e.target.value as 'pt-BR' | 'EN' | 'ES')} className="bg-[#111] border border-white/10 rounded-lg px-2 py-1 text-xs text-gray-300">
            <option value="pt-BR">PT-BR</option><option value="EN">EN</option><option value="ES">ES</option>
          </select>
          <button onClick={toggleFullscreen} className="p-2 text-gray-400 hover:text-white rounded-full hover:bg-white/5">{isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}</button>
          <button onClick={() => setIsSettingsOpen(true)} className="relative p-2 text-gray-400 hover:text-white rounded-full hover:bg-white/5"><Settings className="w-5 h-5" />{apiKeys.length > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-emerald-500 rounded-full border border-[#0a0a0a]" />}</button>
        </div>
      </div>
      <Modal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} title="Gerenciar Chaves API">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-300">Carregar arquivo de chaves (.txt)</label>
          <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-white/10 rounded-lg p-6 flex flex-col items-center cursor-pointer hover:border-indigo-500/50">
            <Upload className="w-8 h-8 text-gray-500 mb-2" />
            <span className="text-sm text-gray-400">Clique para selecionar arquivo</span>
          </div>
          <input type="file" accept=".txt" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
          {uploadStatus && <p className={`text-xs ${uploadStatus.includes('Erro') ? 'text-red-400' : 'text-emerald-400'}`}>{uploadStatus}</p>}
        </div>
      </Modal>
    </header>
  );
};
