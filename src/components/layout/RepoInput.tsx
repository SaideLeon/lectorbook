import { useState } from 'react';
import { motion } from 'motion/react';
import { Upload, Link as LinkIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type InputMode = 'url' | 'pdf' | 'text';

export const RepoInput = ({ onAnalyze, isLoading }: { onAnalyze: (url: string) => void, isLoading: boolean }) => {
  const [mode, setMode] = useState<InputMode>('url');
  const [url, setUrl] = useState('');
  const [textContent, setTextContent] = useState('');
  const [selectedPdfName, setSelectedPdfName] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode !== 'url') return;
    if (url.trim()) onAnalyze(url.trim());
  };

  const modeButtonClasses = (value: InputMode) => cn(
    'h-14 px-8 rounded-2xl border text-3xl tracking-wide transition-colors',
    mode === value
      ? 'border-indigo-500 bg-indigo-500/15 text-indigo-300'
      : 'border-white/15 bg-[#0d0f14] text-gray-400 hover:text-gray-200 hover:border-white/30'
  );

  return (
    <div className="flex min-h-full items-start justify-center text-center px-4 pt-10 pb-16 md:pt-16">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-4xl space-y-12"
      >
        <div className="space-y-5">
          <h1 className="text-6xl md:text-7xl font-semibold tracking-tight text-gray-300">Lectorbook</h1>
          <p className="text-5xl md:text-6xl text-gray-400 max-w-3xl mx-auto leading-snug">
            Leia e converse com artigos usando IA profunda
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="flex flex-wrap justify-center gap-3">
            <button type="button" onClick={() => setMode('url')} className={modeButtonClasses('url')}>URL</button>
            <button type="button" onClick={() => setMode('pdf')} className={modeButtonClasses('pdf')}>PDF UPLOAD</button>
            <button type="button" onClick={() => setMode('text')} className={modeButtonClasses('text')}>TEXTO</button>
          </div>

          <div className="max-w-3xl mx-auto">
            {mode === 'url' && (
              <div className="h-[340px] rounded-3xl border border-white/15 bg-[#0d0f14] p-6 flex items-start">
                <div className="w-full flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                  <LinkIcon className="w-5 h-5 text-gray-500 shrink-0" />
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="Cole aqui a URL do artigo"
                    className="w-full bg-transparent outline-none text-gray-200 placeholder:text-gray-500"
                    disabled={isLoading}
                  />
                </div>
              </div>
            )}

            {mode === 'text' && (
              <textarea
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                placeholder="Cole aqui o conteúdo do artigo"
                className="h-[340px] w-full rounded-3xl border border-white/15 bg-[#0d0f14] p-6 text-4xl text-gray-200 placeholder:text-gray-500 resize-none outline-none focus:border-indigo-500/40"
              />
            )}

            {mode === 'pdf' && (
              <label className="h-[340px] rounded-3xl border-2 border-dashed border-white/20 bg-[#0d0f14] p-6 flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-indigo-500/40 transition-colors">
                <Upload className="w-12 h-12 text-gray-500" />
                <span className="text-4xl text-gray-400">
                  {selectedPdfName || 'Clique para selecionar .pdf'}
                </span>
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => setSelectedPdfName(e.target.files?.[0]?.name || null)}
                />
              </label>
            )}
          </div>

          <button
            type={mode === 'url' ? 'submit' : 'button'}
            disabled={isLoading || (mode === 'url' && !url.trim()) || mode !== 'url'}
            className="h-16 px-12 rounded-2xl text-4xl bg-indigo-700 text-indigo-200 hover:bg-indigo-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Analisar
          </button>
        </form>

        <p className="text-4xl text-gray-500">Exemplos rápidos: NYT · ArXiv · Medium · PubMed</p>
      </motion.div>
    </div>
  );
};
