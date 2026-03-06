import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Copy, Maximize2, Minimize2, X, Glasses } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import DOMPurify from 'dompurify';
import { Article } from '@/types';
import { cn } from '@/lib/utils';

export function ArticleViewer({ article, onClose, isMaximized, onToggleMaximize, onBack, onForward, canGoBack, canGoForward }: { article: Article; onClose: () => void; isMaximized: boolean; onToggleMaximize: () => void; onBack: () => void; onForward: () => void; canGoBack: boolean; canGoForward: boolean; }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const onScroll = () => {
      const max = node.scrollHeight - node.clientHeight;
      setScrollProgress(max > 0 ? (node.scrollTop / max) * 100 : 0);
    };
    node.addEventListener('scroll', onScroll);
    return () => node.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className={cn('flex flex-col bg-[#111] rounded-xl border border-white/10 overflow-hidden h-full', isMaximized ? 'h-full' : 'h-full lg:h-[600px]')}>
      <div className="relative p-3 md:p-4 border-b border-white/10 bg-[#151515] flex items-center justify-between">
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-white/5"><div className="h-full bg-indigo-500 transition-all" style={{ width: `${scrollProgress}%` }} /></div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-black/20 rounded-lg p-1">
            <button onClick={onBack} disabled={!canGoBack} className="p-1 disabled:opacity-40"><ArrowLeft className="w-4 h-4" /></button>
            <button onClick={onForward} disabled={!canGoForward} className="p-1 disabled:opacity-40"><ArrowRight className="w-4 h-4" /></button>
          </div>
          <BookOpen className="w-4 h-4 text-indigo-400 shrink-0" />
          <span className="truncate text-sm">{article.title}</span>
        </div>
        <div className="flex items-center gap-1">
          <button className="p-1.5 hover:bg-white/10 rounded"><Glasses className="w-4 h-4" /></button>
          <button onClick={() => navigator.clipboard.writeText(article.content)} className="p-1.5 hover:bg-white/10 rounded"><Copy className="w-4 h-4" /></button>
          <button onClick={onToggleMaximize} className="p-1.5 hover:bg-white/10 rounded">{isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}</button>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded"><X className="w-4 h-4" /></button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-auto p-6 md:p-10 max-w-3xl mx-auto w-full">
        {article.authors && <p className="text-xs text-gray-500 mb-2">{article.authors.join(', ')}</p>}
        {article.publishedAt && <p className="text-xs text-gray-600 mb-6">{article.publishedAt}</p>}
        <div className="prose prose-invert prose-sm max-w-none">
          <ReactMarkdown>{DOMPurify.sanitize(article.content)}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
