import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { BookOpen, Link2, Upload, Type, Search, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Article } from '@/types';

type Mode = 'url' | 'pdf' | 'text';

export const ArticleInput = ({ onAnalyze, isLoading, recentArticles = [] }: { onAnalyze: (input: string | File, mode: Mode) => void; isLoading: boolean; recentArticles?: Article[] }) => {
  const [mode, setMode] = useState<Mode>('url');
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const canSubmit = useMemo(() => {
    if (mode === 'url') return !!url.trim();
    if (mode === 'text') return !!text.trim();
    return !!file;
  }, [mode, url, text, file]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'url') onAnalyze(url, mode);
    if (mode === 'text') onAnalyze(text, mode);
    if (mode === 'pdf' && file) onAnalyze(file, mode);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 py-12">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-5xl w-full space-y-10">
        <div className="space-y-4">
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight bg-gradient-to-r from-white to-gray-500 bg-clip-text text-transparent">Lector Iota</h1>
          <p className="text-gray-400 text-base md:text-lg max-w-2xl mx-auto">Leia e converse com artigos usando IA profunda</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 max-w-3xl mx-auto w-full">
          <div className="flex gap-2 justify-center">
            {(['url', 'pdf', 'text'] as Mode[]).map(tab => (
              <button key={tab} type="button" onClick={() => setMode(tab)} className={`px-4 py-2 rounded-lg border text-xs uppercase tracking-wider ${mode === tab ? 'border-indigo-500/60 text-indigo-300 bg-indigo-500/10' : 'border-white/10 text-gray-400'}`}>
                {tab === 'url' ? 'URL' : tab === 'pdf' ? 'PDF Upload' : 'Texto'}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {mode === 'url' && (
              <motion.div key="url" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative flex items-center bg-[#111] rounded-xl border border-white/10 p-2">
                <Link2 className="w-5 h-5 text-gray-400 ml-2" />
                <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Cole a URL do artigo" className="flex-1 bg-transparent px-3 py-2 text-sm" />
                <button type="submit" disabled={isLoading || !canSubmit} className="bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-lg text-sm flex items-center gap-2 disabled:opacity-50">{isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}Analisar</button>
              </motion.div>
            )}
            {mode === 'pdf' && (
              <motion.label key="pdf" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="block border-2 border-dashed border-white/10 rounded-xl p-8 text-center cursor-pointer hover:border-indigo-500/40">
                <Upload className="w-8 h-8 mx-auto mb-2 text-gray-500" />
                <p className="text-sm text-gray-400">{file ? file.name : 'Clique para selecionar .pdf'}</p>
                <input type="file" accept=".pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                <button type="submit" disabled={isLoading || !canSubmit} className="mt-4 bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-lg text-sm disabled:opacity-50">Analisar</button>
              </motion.label>
            )}
            {mode === 'text' && (
              <motion.div key="text" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} placeholder="Cole aqui o conteúdo do artigo" className="w-full bg-[#111] rounded-xl border border-white/10 p-4 text-sm" />
                <button type="submit" disabled={isLoading || !canSubmit} className="bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-lg text-sm disabled:opacity-50">Analisar</button>
              </motion.div>
            )}
          </AnimatePresence>
        </form>

        <div className="text-xs text-gray-500">Exemplos rápidos: NYT · ArXiv · Medium · PubMed</div>

        {recentArticles.length > 0 && (
          <div className="space-y-4 text-left">
            <h3 className="text-xs uppercase tracking-wider text-gray-500">Biblioteca Recente</h3>
            <div className="grid md:grid-cols-3 gap-4">
              {recentArticles.slice(0, 6).map(article => (
                <motion.button key={article.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="group flex flex-col gap-3 p-5 bg-[#111] border border-white/5 hover:border-indigo-500/50 rounded-xl">
                  <div className="flex items-center gap-2"><BookOpen className="w-3.5 h-3.5 text-indigo-400" /><span className="font-semibold text-sm truncate">{article.title}</span></div>
                  <p className="text-xs text-gray-500 line-clamp-2">{article.abstract}</p>
                  <div className="flex items-center gap-4 text-[10px] text-gray-500 border-t border-white/5 pt-3 mt-auto"><span>{article.source || 'Fonte'}</span><span>{article.readingTimeMinutes || 1} min leitura</span><span>{formatDistanceToNow(article.addedAt)} atrás</span></div>
                </motion.button>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};
