import { useState } from 'react';
import { FileCode, FileText, Minimize2, Maximize2, X, ArrowLeft, ArrowRight, Copy, Check } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

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
  file: { path: string, content: string }, 
  onClose: () => void, 
  isMaximized: boolean, 
  onToggleMaximize: () => void,
  onBack: () => void,
  onForward: () => void,
  canGoBack: boolean,
  canGoForward: boolean
}) => {
  const extension = file.path.split('.').pop()?.toLowerCase() || 'text';
  const isMarkdownFile = extension === 'md';
  const isTextFile = extension === 'txt';
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(file.content);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className={cn(
      'flex flex-col bg-[#111] rounded-xl border border-white/10 overflow-hidden relative transition-all duration-300', 
      isMaximized ? 'h-[90%]' : 'h-[96%]'
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
            {(isMarkdownFile || isTextFile) ? (
              <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
            ) : (
              <FileCode className="w-4 h-4 text-indigo-400 shrink-0" />
            )}
            <span className="truncate">{file.path}</span>
          </h3>
        </div>
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={handleCopy}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
            title="Copiar conteúdo"
          >
            {isCopied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
          </button>
          <button 
            onClick={onToggleMaximize} 
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white hidden md:block"
            title={isMaximized ? 'Restaurar' : 'Maximizar'}
          >
            {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto text-sm bg-[#0d0d0d]">
        {isMarkdownFile ? (
          <article className="prose prose-invert prose-sm max-w-none p-6">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{file.content}</ReactMarkdown>
          </article>
        ) : isTextFile ? (
          <div className="p-6 text-gray-200 leading-relaxed whitespace-pre-wrap font-mono text-xs md:text-sm">
            {file.content}
          </div>
        ) : (
          <SyntaxHighlighter
            language={extension}
            style={atomDark}
            showLineNumbers
            customStyle={{ margin: 0, padding: '1.5rem', background: '#0d0d0d', minHeight: '100%' }}
          >
            {file.content}
          </SyntaxHighlighter>
        )}
      </div>
    </div>
  );
};
