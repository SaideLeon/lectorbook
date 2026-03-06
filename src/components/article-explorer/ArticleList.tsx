import { useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { FileText } from 'lucide-react';
import { Article } from '@/types';

export function ArticleList({ articles, selectedId, onSelect }: { articles: Article[]; selectedId?: string; onSelect: (id: string) => void }) {
  const [search, setSearch] = useState('');
  const parentRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => articles.filter(a => a.title.toLowerCase().includes(search.toLowerCase())), [articles, search]);
  const rowVirtualizer = useVirtualizer({ count: filtered.length, getScrollElement: () => parentRef.current, estimateSize: () => 72, overscan: 6 });

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <div className="text-xs uppercase text-gray-500 mb-3">Artigos na Biblioteca</div>
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar artigos..." className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2 text-sm mb-3" />
      <div ref={parentRef} className="flex-1 overflow-auto">
        <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
          {rowVirtualizer.getVirtualItems().map(virtualItem => {
            const article = filtered[virtualItem.index];
            return (
              <div key={article.id} style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${virtualItem.start}px)` }}>
                <button onClick={() => onSelect(article.id)} className={`w-full text-left px-2 py-2 rounded-md hover:bg-white/5 text-sm transition-colors flex flex-col gap-1 group ${selectedId === article.id ? 'bg-white/5 text-white' : 'text-gray-300 hover:text-white'}`}>
                  <span className="flex items-center gap-2"><FileText className="w-3.5 h-3.5 text-indigo-400/80 shrink-0" /><span className="truncate font-medium">{article.title}</span></span>
                  <span className="text-[10px] text-gray-500 pl-5.5">{article.source || 'Fonte'} · {article.readingTimeMinutes || 1}min</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
