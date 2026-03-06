import { useState, useMemo, useRef, useEffect } from 'react';
import { Search, FileCode, FileText, Folder, FolderOpen, ChevronRight, ChevronDown } from 'lucide-react';
import { FileNode } from '@/types';
import { useVirtualizer } from '@tanstack/react-virtual';
import { buildTree, flattenTree } from '@/utils/file-tree';
import { cn } from '@/lib/utils';

export const FileTree = ({ files, onSelect }: { files: FileNode[], onSelect: (path: string) => void }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const parentRef = useRef<HTMLDivElement>(null);

  // Build the tree structure
  const tree = useMemo(() => buildTree(files), [files]);

  // Filter and Flatten
  const flatNodes = useMemo(() => {
    // If searching, we might want to show all matching files flat, or filter the tree
    // For simplicity, if searching, show flat list of matches.
    // If not searching, show tree.
    
    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      return files
        .filter(f => f.path.toLowerCase().includes(lowerTerm))
        .map(f => ({
          id: f.path,
          name: f.path, // Show full path in search
          path: f.path,
          type: f.type,
          level: 0,
          children: [],
          isExpanded: false,
          hasChildren: false
        }));
    }

    return flattenTree(tree, expandedIds);
  }, [tree, expandedIds, searchTerm, files]);

  const rowVirtualizer = useVirtualizer({
    count: flatNodes.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 28, // 28px per row
    overscan: 5,
  });

  const toggleExpand = (path: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  // Auto-expand root folders initially if tree is small? 
  // Or just leave collapsed. Let's leave collapsed but maybe expand 'src' if it exists.
  useEffect(() => {
    if (files.length > 0 && expandedIds.size === 0 && !searchTerm) {
        // Optional: Expand first level directories
        const topLevelDirs = files.filter(f => f.type === 'tree' && !f.path.includes('/')).map(f => f.path);
        if (topLevelDirs.length < 5) {
            setExpandedIds(new Set(topLevelDirs));
        }
    }
  }, [files]);

  return (
    <div className="h-full flex flex-col">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Arquivos do Repositório</h3>
      
      <div className="relative mb-4">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar arquivos..."
          className="w-full bg-[#1a1a1a] border border-white/10 rounded-md py-1.5 pl-8 pr-3 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 transition-colors"
        />
      </div>

      <div ref={parentRef} className="flex-1 overflow-y-auto pr-2">
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const node = flatNodes[virtualRow.index];
            const isFolder = node.type === 'tree';
            const isPdf = node.path.toLowerCase().endsWith('.pdf');
            
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
                <button
                  onClick={() => {
                    if (isFolder) {
                      toggleExpand(node.path);
                    } else {
                      onSelect(node.path);
                    }
                  }}
                  className={cn(
                    "w-full text-left px-2 py-1 rounded-md hover:bg-white/5 text-sm text-gray-300 hover:text-white transition-colors flex items-center gap-2 truncate group",
                    !isFolder && "cursor-pointer",
                    isFolder && "cursor-pointer font-medium text-gray-200"
                  )}
                  style={{ paddingLeft: searchTerm ? '8px' : `${node.level * 16 + 8}px` }}
                >
                  {isFolder ? (
                    <span className="flex items-center gap-1.5 min-w-0">
                      {node.isExpanded ? (
                        <ChevronDown className="w-3 h-3 text-gray-500" />
                      ) : (
                        <ChevronRight className="w-3 h-3 text-gray-500" />
                      )}
                      {node.isExpanded ? (
                        <FolderOpen className="w-4 h-4 text-indigo-400" />
                      ) : (
                        <Folder className="w-4 h-4 text-indigo-400/80" />
                      )}
                      <span className="truncate">{node.name}</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-2 min-w-0">
                      {isPdf ? <FileText className="w-4 h-4 text-red-400/80 group-hover:text-red-400 shrink-0" /> : <FileCode className="w-4 h-4 text-gray-500 group-hover:text-indigo-400 shrink-0" />}
                      <span className="truncate">{node.name}</span>
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
        
        {flatNodes.length === 0 && (
          <div className="text-xs text-gray-500 italic text-center py-4">
            Nenhum arquivo encontrado.
          </div>
        )}
      </div>
    </div>
  );
};
