import { useState } from 'react';
import { FileCode, Minimize2, Maximize2, X, ArrowLeft, ArrowRight, Copy, Check, FileText } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { cn } from '@/lib/utils';
import { SelectedFile } from '@/types';

export const FileViewer = ({ 
  file, 
  onClose, 
  isMaximized, 
  onToggleMaximize,
  onBack,
  onForward,
  canGoBack,
  canGoForward
}: { 
  file: SelectedFile,
  onClose: () => void, 
  isMaximized: boolean, 
  onToggleMaximize: () => void,
  onBack: () => void,
  onForward: () => void,
  canGoBack: boolean,
  canGoForward: boolean
}) => {
  const extension = file.path.split('.').pop() || 'text';
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = async () => {
    if (!file.content) return;
    await navigator.clipboard.writeText(file.content);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const isPdf = file.type === 'pdf' && !!file.pdfBlobUrl;

  return (
    <div className={cn(
      "flex flex-col bg-[#111] rounded-xl border border-white/10 overflow-hidden relative transition-all duration-300", 
      isMaximized ? "h-full" : "h-full lg:h-[600px]"
    )}>
      <div className="p-3 md:p-4 border-b border-white/10 bg-[#151515] flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-1 bg-black/20 rounded-lg p-1 shrink-0">
            <button 
              onClick={onBack}
              disabled={!canGoBack}
              className="p-1 hover:bg-white/10 rounded-md transition-colors text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
              title="Voltar"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <button 
              onClick={onForward}
              disabled={!canGoForward}
              className="p-1 hover:bg-white/10 rounded-md transition-colors text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
              title="Avançar"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <h3 className="font-medium flex items-center gap-2 truncate text-sm">
            {isPdf ? <FileText className="w-4 h-4 text-red-400 shrink-0" /> : <FileCode className="w-4 h-4 text-indigo-400 shrink-0" />}
            <span className="truncate">{file.path}</span>
          </h3>
        </div>
        <div className="flex items-center justify-end gap-1">
          {file.type === 'text' && (
            <button
              onClick={handleCopy}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
              title="Copiar conteúdo"
            >
              {isCopied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            </button>
          )}
          <button 
            onClick={onToggleMaximize} 
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white hidden md:block"
            title={isMaximized ? "Restaurar" : "Maximizar"}
          >
            {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto text-sm bg-[#0d0d0d]">
        {isPdf ? (
          <iframe
            src={file.pdfBlobUrl}
            title={file.path}
            className="w-full h-full min-h-[480px] border-0"
          />
        ) : (
          <SyntaxHighlighter
            language={extension}
            style={atomDark}
            showLineNumbers
            customStyle={{ margin: 0, padding: '1.5rem', background: '#0d0d0d', minHeight: '100%' }}
          >
            {file.content || ''}
          </SyntaxHighlighter>
        )}
      </div>
    </div>
  );
};
