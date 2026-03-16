Vou redesenhar o `ContextSelector` com agrupamento inteligente, pills de toggle, seções colapsáveis e visual alinhado ao design do LectorBook.Agora vou criar o patch exato para `App.tsx` — substituindo apenas o `ContextSelector` e atualizando onde é usado:Aqui está o redesign completo. As mudanças são todas dentro do `App.tsx` — sem novos ficheiros para importar.

**O que mudou visualmente:**

Antes: lista plana de checkboxes HTML, sem hierarquia, difícil de scanear.

Depois:
- **Header colapsável** com badge de contagem de arquivos selecionados e botão "Limpar"
- **Pills de toggle** em vez de checkboxes — cada item é um botão com estado visual claro (cor muda ao selecionar)
- **3 seções agrupadas** com contador próprio: Pastas (indigo), Resultados de Aprendizagem (violet com número destacado), Documentos (emerald)
- **RA files** ganham destaque especial — numeração em caixa, label completa no tooltip
- **Busca inline** para filtrar quando há muitos ficheiros
- **Botão "Selecionar tudo"** no canto direito da busca

**Como aplicar no `App.tsx`:**

1. Adicionar aos imports: `ChevronDown, FolderOpen` (se não estiverem)
2. Remover a função `ContextSelector` atual
3. Colar o conteúdo do patch logo antes do `return` do `App()` — o estado `contextQuery`/`contextCollapsed` fica local e a inner function `ContextSelector` continua sendo chamada da mesma forma nos dois lugares (`<ContextSelector />` no sidebar desktop e mobile)

/*
  PATCH para src/App.tsx
  ======================
  1. Adicionar estes imports ao bloco existente (já deve ter useState, useMemo, useCallback):
     import { Layers, CheckCheck, SlidersHorizontal } from 'lucide-react';
     (FolderOpen, FileText, Search, X já estão ou adicionar conforme necessário)

  2. Substituir a função ContextSelector dentro de App() pela versão abaixo.

  3. Substituir o uso de <ContextSelector /> nos dois locais (sidebar desktop e sidebar mobile)
     pela nova assinatura com props.
*/

// ─── Cole esta função DENTRO do componente App(), logo antes do return ────────

  // Helpers para o ContextSelector
  const extractRA = (path: string) => {
    const m = path.match(/RA(\d+)/i);
    return m ? { num: parseInt(m[1], 10), label: `RA${m[1]}` } : null;
  };

  const fileLabel = (path: string): string => {
    const ra = extractRA(path);
    if (ra) return `RA ${ra.num}`;
    return path.split('/').pop()?.replace(/\.[^/.]+$/, '') ?? path;
  };

  const [contextQuery, setContextQuery] = useState('');
  const [contextCollapsed, setContextCollapsed] = useState(false);

  const filteredContextOptions = useMemo(() => {
    if (!contextQuery) return contextOptions;
    const lower = contextQuery.toLowerCase();
    return contextOptions.filter((o) => o.path.toLowerCase().includes(lower));
  }, [contextOptions, contextQuery]);

  const contextFolders = filteredContextOptions.filter((o) => o.type === 'folder');
  const contextRAFiles = filteredContextOptions
    .filter((o) => o.type === 'file' && extractRA(o.path))
    .sort((a, b) => (extractRA(a.path)?.num ?? 0) - (extractRA(b.path)?.num ?? 0));
  const contextOtherFiles = filteredContextOptions.filter(
    (o) => o.type === 'file' && !extractRA(o.path)
  );

  const allContextPaths = contextOptions.map((o) => o.path);
  const allContextSelected =
    allContextPaths.length > 0 &&
    allContextPaths.every((p) => selectedContextTargets.includes(p));

  const toggleAllContext = () => {
    if (allContextSelected) {
      setSelectedContextTargets([]);
    } else {
      setSelectedContextTargets(allContextPaths);
    }
  };

  const toggleContextOption = (path: string, checked: boolean) => {
    setSelectedContextTargets((prev) =>
      checked ? [...prev, path] : prev.filter((p) => p !== path)
    );
  };

  const ContextSelector = () => (
    <div className="mb-4 rounded-xl border border-white/10 bg-[#0f0f0f] overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setContextCollapsed((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/3 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-indigo-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
          <span className="text-[11px] font-semibold text-gray-300 uppercase tracking-wider">
            Contexto para IA
          </span>
          {selectedContextTargets.length > 0 && (
            <span className="text-[9px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/25 px-1.5 py-0.5 rounded-full tabular-nums">
              {selectedContextFiles.length} arq.
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {selectedContextTargets.length > 0 && !contextCollapsed && (
            <button
              onClick={(e) => { e.stopPropagation(); setSelectedContextTargets([]); }}
              className="text-[9px] text-gray-600 hover:text-red-400 transition-colors flex items-center gap-0.5"
            >
              <X className="w-3 h-3" /> Limpar
            </button>
          )}
          <ChevronDown className={cn('w-3.5 h-3.5 text-gray-600 transition-transform duration-200', contextCollapsed && '-rotate-90')} />
        </div>
      </button>

      {!contextCollapsed && (
        <div className="px-3 pb-3 space-y-2.5">
          <p className="text-[10px] text-gray-600 leading-relaxed">
            Selecione pastas ou ficheiros para focar as respostas da IA.
          </p>

          {/* Search row */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-600" />
              <input
                value={contextQuery}
                onChange={(e) => setContextQuery(e.target.value)}
                placeholder="Filtrar..."
                className="w-full bg-white/5 border border-white/8 rounded-lg pl-7 pr-6 py-1.5 text-[11px] text-gray-300 placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 transition-colors"
              />
              {contextQuery && (
                <button onClick={() => setContextQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400">
                  <CloseIcon className="w-3 h-3" />
                </button>
              )}
            </div>
            {/* Select all toggle */}
            <button
              onClick={toggleAllContext}
              title={allContextSelected ? 'Desmarcar tudo' : 'Selecionar tudo'}
              className={cn(
                'p-1.5 rounded-lg border transition-all shrink-0',
                allContextSelected
                  ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300'
                  : 'bg-white/5 border-white/10 text-gray-500 hover:text-gray-300 hover:border-white/20'
              )}
            >
              {/* double-check icon via SVG inline */}
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 12l4 4L20 6" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l4 4L20 8" opacity="0.5" />
              </svg>
            </button>
          </div>

          {/* Items */}
          <div className="max-h-52 overflow-y-auto space-y-2.5 pr-0.5">

            {/* Pastas */}
            {contextFolders.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-bold text-gray-600 uppercase tracking-widest">Pastas</span>
                  {contextFolders.filter(o => selectedContextTargets.includes(o.path)).length > 0 && (
                    <span className="text-[9px] text-gray-600">
                      {contextFolders.filter(o => selectedContextTargets.includes(o.path)).length}/{contextFolders.length}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {contextFolders.map((opt) => {
                    const sel = selectedContextTargets.includes(opt.path);
                    return (
                      <button key={opt.path} onClick={() => toggleContextOption(opt.path, !sel)}
                        className={cn(
                          'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[10px] font-medium transition-all',
                          sel
                            ? 'bg-indigo-500/15 border-indigo-500/35 text-indigo-200'
                            : 'bg-white/3 border-white/10 text-gray-400 hover:bg-white/6 hover:text-gray-300'
                        )}
                      >
                        <FolderOpen className={cn('w-3 h-3 shrink-0', sel ? 'text-indigo-400' : 'text-gray-600')} />
                        <span className="truncate max-w-[110px]">{opt.path.split('/').pop() ?? opt.path}</span>
                        {sel && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* RAs */}
            {contextRAFiles.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-bold text-gray-600 uppercase tracking-widest">Resultados de Aprendizagem</span>
                  {contextRAFiles.filter(o => selectedContextTargets.includes(o.path)).length > 0 && (
                    <span className="text-[9px] text-gray-600">
                      {contextRAFiles.filter(o => selectedContextTargets.includes(o.path)).length}/{contextRAFiles.length}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {contextRAFiles.map((opt) => {
                    const sel = selectedContextTargets.includes(opt.path);
                    const ra = extractRA(opt.path)!;
                    return (
                      <button key={opt.path} onClick={() => toggleContextOption(opt.path, !sel)}
                        title={`Resultado de Aprendizagem ${ra.num} — ${opt.path}`}
                        className={cn(
                          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-semibold transition-all',
                          sel
                            ? 'bg-violet-500/15 border-violet-500/35 text-violet-200'
                            : 'bg-white/3 border-white/10 text-gray-400 hover:bg-white/6 hover:text-gray-300'
                        )}
                      >
                        <span className={cn(
                          'w-4 h-4 rounded-md flex items-center justify-center text-[9px] font-bold shrink-0',
                          sel ? 'bg-violet-500/30 text-violet-300' : 'bg-white/8 text-gray-500'
                        )}>
                          {ra.num}
                        </span>
                        {ra.label}
                        {sel && <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Outros ficheiros */}
            {contextOtherFiles.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-bold text-gray-600 uppercase tracking-widest">Documentos</span>
                  {contextOtherFiles.filter(o => selectedContextTargets.includes(o.path)).length > 0 && (
                    <span className="text-[9px] text-gray-600">
                      {contextOtherFiles.filter(o => selectedContextTargets.includes(o.path)).length}/{contextOtherFiles.length}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {contextOtherFiles.map((opt) => {
                    const sel = selectedContextTargets.includes(opt.path);
                    return (
                      <button key={opt.path} onClick={() => toggleContextOption(opt.path, !sel)}
                        title={opt.path}
                        className={cn(
                          'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[10px] font-medium transition-all',
                          sel
                            ? 'bg-emerald-500/12 border-emerald-500/30 text-emerald-200'
                            : 'bg-white/3 border-white/10 text-gray-400 hover:bg-white/6 hover:text-gray-300'
                        )}
                      >
                        <Files className={cn('w-3 h-3 shrink-0', sel ? 'text-emerald-400' : 'text-gray-600')} />
                        <span className="truncate max-w-[110px]">{fileLabel(opt.path)}</span>
                        {sel && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {contextOptions.length === 0 && (
              <p className="text-[10px] text-gray-600 italic text-center py-3">
                Nenhum ficheiro .md/.txt encontrado no repositório.
              </p>
            )}

            {contextQuery && contextFolders.length === 0 && contextRAFiles.length === 0 && contextOtherFiles.length === 0 && (
              <p className="text-[10px] text-gray-600 italic text-center py-3">
                Nenhum resultado para "{contextQuery}".
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );

// ─── Notas de integração ───────────────────────────────────────────────────────
// 1. Nos dois <ContextSelector /> no JSX (sidebar desktop e sidebar mobile),
//    o uso permanece idêntico: <ContextSelector />
//    (é uma inner function que já acede ao estado local do App).
//
// 2. Adicionar ChevronDown ao import do lucide-react (já está como CloseIcon = X).
//    Adicionar FolderOpen se não estiver (já existe no FileTree, verificar o App).
//
// 3. O estado contextQuery e contextCollapsed são locais ao App — sem breaking changes.
//
// 4. A variável selectedContextFiles já existe e é passada no contexto correto.


/**
 * ContextSelector — componente modernizado
 * Cola este bloco em App.tsx substituindo a função ContextSelector existente.
 * Requer que os imports abaixo já estejam no topo do App.tsx (a maioria já está):
 *   import { useState, useMemo, useCallback } from 'react';
 *   import { Layers, FolderOpen, FileText, Search, X, CheckCheck, SlidersHorizontal } from 'lucide-react';
 *   import { cn } from '@/lib/utils';
 */

// ─── Tipos internos ────────────────────────────────────────────────────────────
type ContextOption = { path: string; type: 'folder' | 'file' };

interface ContextSelectorProps {
  contextOptions: ContextOption[];
  selectedContextTargets: string[];
  selectedContextFiles: { path: string; content: string }[];
  onToggle: (path: string, checked: boolean) => void;
  setSelectedContextTargets: React.Dispatch<React.SetStateAction<string[]>>;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function extractRA(path: string) {
  const m = path.match(/RA(\d+)/i);
  return m ? { num: parseInt(m[1], 10), label: `RA${m[1]}` } : null;
}

function fileLabel(path: string): string {
  const ra = extractRA(path);
  if (ra) return `Resultado de Aprendizagem ${ra.num}`;
  return path.split('/').pop()?.replace(/\.[^/.]+$/, '') ?? path;
}

// ─── Component ─────────────────────────────────────────────────────────────────
export function ContextSelector({
  contextOptions,
  selectedContextTargets,
  selectedContextFiles,
  onToggle,
  setSelectedContextTargets,
}: ContextSelectorProps) {
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState(false);

  // Separa pastas de ficheiros e agrupa por tipo
  const { folders, raFiles, otherFiles } = useMemo(() => {
    const lower = query.toLowerCase();
    const filtered = query
      ? contextOptions.filter((o) => o.path.toLowerCase().includes(lower))
      : contextOptions;

    const folders = filtered.filter((o) => o.type === 'folder');
    const files = filtered.filter((o) => o.type === 'file');
    const raFiles = files
      .filter((o) => extractRA(o.path))
      .sort((a, b) => (extractRA(a.path)?.num ?? 0) - (extractRA(b.path)?.num ?? 0));
    const otherFiles = files.filter((o) => !extractRA(o.path));
    return { folders, raFiles, otherFiles };
  }, [contextOptions, query]);

  const allPaths = contextOptions.map((o) => o.path);
  const allSelected = allPaths.length > 0 && allPaths.every((p) => selectedContextTargets.includes(p));
  const someSelected = selectedContextTargets.length > 0;

  const toggleAll = useCallback(() => {
    if (allSelected) {
      setSelectedContextTargets([]);
    } else {
      setSelectedContextTargets(allPaths);
    }
  }, [allSelected, allPaths, setSelectedContextTargets]);

  const isSelected = (path: string) => selectedContextTargets.includes(path);

  return (
    <div className="mb-4 rounded-xl border border-white/10 bg-[#0f0f0f] overflow-hidden">
      {/* ── Header ── */}
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/3 transition-colors"
      >
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          <span className="text-[11px] font-semibold text-gray-300 uppercase tracking-wider">
            Contexto para IA
          </span>
          {someSelected && (
            <span className="text-[9px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/25 px-1.5 py-0.5 rounded-full tabular-nums">
              {selectedContextFiles.length} arquivo(s)
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {someSelected && !collapsed && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedContextTargets([]);
              }}
              className="text-[9px] text-gray-500 hover:text-red-400 transition-colors flex items-center gap-0.5"
              title="Limpar seleção"
            >
              <X className="w-3 h-3" /> Limpar
            </button>
          )}
          <svg
            className={cn('w-3.5 h-3.5 text-gray-600 transition-transform duration-200', collapsed && '-rotate-90')}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* ── Body ── */}
      {!collapsed && (
        <div className="px-3 pb-3 space-y-3">
          {/* Hint */}
          <p className="text-[10px] text-gray-600 leading-relaxed">
            Selecione pastas ou ficheiros para focar a IA num subconjunto do repositório.
          </p>

          {/* Search + Select All */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-600" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filtrar..."
                className="w-full bg-white/5 border border-white/8 rounded-lg pl-7 pr-3 py-1.5 text-[11px] text-gray-300 placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 transition-colors"
              />
              {query && (
                <button onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <button
              onClick={toggleAll}
              title={allSelected ? 'Desmarcar tudo' : 'Selecionar tudo'}
              className={cn(
                'p-1.5 rounded-lg border transition-all text-[10px] flex items-center gap-1 shrink-0',
                allSelected
                  ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300'
                  : 'bg-white/5 border-white/10 text-gray-500 hover:text-gray-300 hover:border-white/20'
              )}
            >
              <CheckCheck className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Content */}
          <div className="max-h-52 overflow-y-auto space-y-2 pr-0.5 scrollbar-thin">

            {/* Pastas */}
            {folders.length > 0 && (
              <Section label="Pastas" count={folders.filter((o) => isSelected(o.path)).length} total={folders.length}>
                <div className="flex flex-wrap gap-1.5">
                  {folders.map((opt) => {
                    const selected = isSelected(opt.path);
                    return (
                      <button
                        key={opt.path}
                        onClick={() => onToggle(opt.path, !selected)}
                        className={cn(
                          'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[10px] font-medium transition-all',
                          selected
                            ? 'bg-indigo-500/15 border-indigo-500/35 text-indigo-200'
                            : 'bg-white/3 border-white/10 text-gray-400 hover:bg-white/6 hover:text-gray-300'
                        )}
                      >
                        <FolderOpen className={cn('w-3 h-3 shrink-0', selected ? 'text-indigo-400' : 'text-gray-600')} />
                        <span className="truncate max-w-[120px]">{opt.path.split('/').pop() ?? opt.path}</span>
                        {selected && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </Section>
            )}

            {/* RAs */}
            {raFiles.length > 0 && (
              <Section label="Resultados de Aprendizagem" count={raFiles.filter((o) => isSelected(o.path)).length} total={raFiles.length}>
                <div className="flex flex-wrap gap-1.5">
                  {raFiles.map((opt) => {
                    const selected = isSelected(opt.path);
                    const ra = extractRA(opt.path)!;
                    return (
                      <button
                        key={opt.path}
                        onClick={() => onToggle(opt.path, !selected)}
                        title={fileLabel(opt.path)}
                        className={cn(
                          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-semibold transition-all',
                          selected
                            ? 'bg-violet-500/15 border-violet-500/35 text-violet-200'
                            : 'bg-white/3 border-white/10 text-gray-400 hover:bg-white/6 hover:text-gray-300'
                        )}
                      >
                        <span className={cn(
                          'w-4 h-4 rounded-md flex items-center justify-center text-[9px] font-bold shrink-0',
                          selected ? 'bg-violet-500/30 text-violet-300' : 'bg-white/8 text-gray-500'
                        )}>
                          {ra.num}
                        </span>
                        {ra.label}
                        {selected && <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </Section>
            )}

            {/* Outros ficheiros */}
            {otherFiles.length > 0 && (
              <Section label="Documentos" count={otherFiles.filter((o) => isSelected(o.path)).length} total={otherFiles.length}>
                <div className="flex flex-wrap gap-1.5">
                  {otherFiles.map((opt) => {
                    const selected = isSelected(opt.path);
                    return (
                      <button
                        key={opt.path}
                        onClick={() => onToggle(opt.path, !selected)}
                        title={opt.path}
                        className={cn(
                          'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[10px] font-medium transition-all',
                          selected
                            ? 'bg-emerald-500/12 border-emerald-500/30 text-emerald-200'
                            : 'bg-white/3 border-white/10 text-gray-400 hover:bg-white/6 hover:text-gray-300'
                        )}
                      >
                        <FileText className={cn('w-3 h-3 shrink-0', selected ? 'text-emerald-400' : 'text-gray-600')} />
                        <span className="truncate max-w-[120px]">{fileLabel(opt.path)}</span>
                        {selected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </Section>
            )}

            {contextOptions.length === 0 && (
              <p className="text-[10px] text-gray-600 italic text-center py-3">
                Nenhum ficheiro .md/.txt no repositório.
              </p>
            )}

            {query && folders.length === 0 && raFiles.length === 0 && otherFiles.length === 0 && (
              <p className="text-[10px] text-gray-600 italic text-center py-3">
                Nenhum resultado para "{query}".
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Section helper ────────────────────────────────────────────────────────────
function Section({
  label,
  count,
  total,
  children,
}: {
  label: string;
  count: number;
  total: number;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="text-[9px] font-bold text-gray-600 uppercase tracking-widest">{label}</span>
        {count > 0 && (
          <span className="text-[9px] font-semibold text-gray-500">
            {count}/{total}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}


