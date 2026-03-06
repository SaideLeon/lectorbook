import { useMemo, useRef, useState } from 'react';
import { RefreshCw, FileText, FileType2, FileArchive, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Article, PersonalFile } from '@/types';
import { cn } from '@/lib/utils';

interface PersonalLibraryPanelProps {
  files: PersonalFile[];
  isConnected: boolean;
  isLoadingFiles: boolean;
  error: string | null;
  onRefresh: () => Promise<void>;
  onOpenFile: (path: string) => Promise<Article>;
  onFileSelect: (article: Article) => void;
}

type Node = {
  id: string;
  name: string;
  path: string;
  level: number;
  kind: 'folder' | 'file';
  file?: PersonalFile;
};

const typeBadgeStyles: Record<PersonalFile['type'], string> = {
  pdf: 'bg-red-500/20 text-red-300 border border-red-500/40',
  md: 'bg-blue-500/20 text-blue-300 border border-blue-500/40',
  txt: 'bg-gray-500/20 text-gray-300 border border-gray-500/40',
};

function getFileIcon(type: PersonalFile['type']) {
  if (type === 'pdf') return FileArchive;
  if (type === 'md') return FileType2;
  return FileText;
}

export function PersonalLibraryPanel({ files, isConnected, isLoadingFiles, error, onRefresh, onOpenFile, onFileSelect }: PersonalLibraryPanelProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['']));
  const [openingPath, setOpeningPath] = useState<string | null>(null);
  const parentRef = useRef<HTMLDivElement>(null);

  const nodes = useMemo(() => {
    const next: Node[] = [];
    const folderSet = new Set<string>();

    for (const file of files) {
      const parts = file.path.split('/');
      for (let i = 0; i < parts.length - 1; i++) {
        const folderPath = parts.slice(0, i + 1).join('/');
        if (!folderSet.has(folderPath)) {
          folderSet.add(folderPath);
          next.push({
            id: `folder:${folderPath}`,
            name: parts[i],
            path: folderPath,
            level: i,
            kind: 'folder',
          });
        }
      }

      next.push({
        id: `file:${file.path}`,
        name: file.name,
        path: file.path,
        level: Math.max(parts.length - 1, 0),
        kind: 'file',
        file,
      });
    }

    return next.sort((a, b) => a.path.localeCompare(b.path));
  }, [files]);

  const visibleNodes = useMemo(() => {
    return nodes.filter((node) => {
      if (node.level === 0) return true;
      const parentPath = node.path.split('/').slice(0, -1).join('/');
      if (!parentPath) return true;
      const segments = parentPath.split('/');
      for (let i = 0; i < segments.length; i++) {
        const current = segments.slice(0, i + 1).join('/');
        if (!expandedFolders.has(current)) return false;
      }
      return true;
    });
  }, [nodes, expandedFolders]);

  const rowVirtualizer = useVirtualizer({
    count: visibleNodes.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 34,
    overscan: 8,
  });

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const handleOpenFile = async (filePath: string) => {
    setOpeningPath(filePath);
    try {
      const article = await onOpenFile(filePath);
      onFileSelect(article);
    } finally {
      setOpeningPath(null);
    }
  };

  if (!isConnected) {
    return <p className="text-xs text-gray-500">Conecte sua biblioteca pessoal nas configurações para ver os arquivos.</p>;
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Repositório</h3>
        <button onClick={onRefresh} disabled={isLoadingFiles} className="text-xs text-indigo-300 hover:text-indigo-200 flex items-center gap-1 disabled:opacity-50">
          <RefreshCw className={cn('w-3 h-3', isLoadingFiles && 'animate-spin')} />
          Atualizar
        </button>
      </div>

      {error && <p className="text-xs text-red-400 mb-2">{error}</p>}
      {isLoadingFiles && <p className="text-xs text-gray-400 mb-2">Carregando arquivos...</p>}

      <div ref={parentRef} className="flex-1 overflow-y-auto pr-2">
        <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const node = visibleNodes[virtualRow.index];
            if (!node) return null;

            return (
              <div
                key={node.id}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                className="flex items-center"
              >
                {node.kind === 'folder' ? (
                  <button
                    onClick={() => toggleFolder(node.path)}
                    className="w-full px-2 py-1 rounded hover:bg-white/5 text-xs text-gray-300 flex items-center gap-1"
                    style={{ paddingLeft: `${node.level * 16 + 8}px` }}
                  >
                    {expandedFolders.has(node.path) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    <span className="truncate">{node.name}</span>
                  </button>
                ) : node.file ? (
                  <button
                    onClick={() => handleOpenFile(node.path)}
                    className="w-full px-2 py-1 rounded hover:bg-white/5 text-xs text-gray-200 flex items-center justify-between gap-2"
                    style={{ paddingLeft: `${node.level * 16 + 8}px` }}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      {(() => {
                        const Icon = getFileIcon(node.file!.type);
                        return <Icon className="w-3.5 h-3.5 shrink-0 text-gray-500" />;
                      })()}
                      <span className="truncate">{node.name}</span>
                    </span>
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded uppercase', typeBadgeStyles[node.file.type])}>{node.file.type}</span>
                    {openingPath === node.path && <Loader2 className="w-3 h-3 animate-spin text-indigo-300" />}
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {!isLoadingFiles && files.length === 0 && <p className="text-xs text-gray-500 text-center py-3">Nenhum arquivo suportado encontrado (.pdf, .md, .txt).</p>}
    </div>
  );
}
