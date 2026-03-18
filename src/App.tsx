import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Loader2,
  FileText,
  MessageSquare,
  Eye,
  Menu,
  X as CloseIcon,
  BookOpen,
  ChevronDown,
  FolderOpen,
  Search,
  CheckCheck,
  SlidersHorizontal,
  Radio,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Components
import { Header } from '@/components/layout/Header';
import { RepoInput } from '@/components/layout/RepoInput';
import { FileTree } from '@/components/file-explorer/FileTree';
import { FileViewer } from '@/components/file-explorer/FileViewer';
import { ChatInterface } from '@/components/ai-chat/ChatInterface';
import { QuizInterface } from '@/components/quiz/QuizInterface';
import { LiveVoicePanel } from '@/components/live-voice/LiveVoicePanel';

// Student components
import { StudentProfileModal } from '@/components/student/StudentProfileModal';
import { StudentDashboard } from '@/components/student/StudentDashboard';
import { LevelUpToast } from '@/components/student/LevelUpToast';

// Hooks
import { useGithubRepository } from '@/hooks/useGithubRepository';
import { useAIChat } from '@/hooks/useAIChat';
import { useStudentProfile } from '@/hooks/useStudentProfile';

import { useToast } from '@/components/ui/Toast';
import { QuizQuestion } from '@/types';

type MobileTab = 'files' | 'chat' | 'preview' | 'quiz' | 'live';
type ActiveMode = 'chat' | 'quiz' | 'live';

export default function App() {
  const { showToast, hideToast } = useToast();
  const [maximizedPanel, setMaximizedPanel] = useState<'chat' | 'file' | null>(null);
  const [activeMobileTab, setActiveMobileTab] = useState<MobileTab>('chat');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeMode, setActiveMode] = useState<ActiveMode>('chat');
  const [selectedContextTargets, setSelectedContextTargets] = useState<string[]>([]);

  // Student profile hook
  const {
    student,
    isLoading: isStudentLoading,
    isProfileOpen,
    authMode,
    isDashboardOpen,
    ranking,
    repoRanking,
    quizHistory,
    isLoadingHistory,
    levelUpInfo,
    lastAccessCode,
    createProfile,
    loginWithAccessCode,
    recoverAccessCode,
    updateProfile,
    saveQuizResult,
    openSignup,
    openLogin,
    openProfile,
    closeProfile,
    openDashboard,
    closeDashboard,
    loadRanking,
    loadQuizHistory,
  } = useStudentProfile();

  // Custom Hooks
  const handleRepositoryUpdated = useCallback(() => {
    showToast('Repositório atualizado no GitHub. Reanalisando automaticamente...', 'info');
  }, [showToast]);

  const {
    repoUrl,
    files,
    repoDescription,
    isLoading: isRepoLoading,
    error: repoError,
    selectedFile,
    teachingDocs,
    fileHistory,
    currentHistoryIndex,
    analyzeRepository,
    selectFile,
    navigateBack,
    navigateForward,
    clearRepository,
    setSelectedFile,
    setError: setRepoError
  } = useGithubRepository(handleRepositoryUpdated);

  const {
    chatHistory,
    isThinking,
    isWaitingForFirstChunk,
    analysis,
    isGeneratingReadingSheet,
    isTranscribingAudio,
    isSynthesizingAudio,
    processLogs,
    performInitialAnalysis,
    sendMessage,
    transcribeAudioMessage,
    synthesizeMessageAudio,
    generateReadingSheet,
    apiKeys,
    keyIndex,
    handleKeyFileUpload
  } = useAIChat();

  // Reset mode when repository is cleared
  useEffect(() => {
    if (!repoUrl) setActiveMode('chat');
  }, [repoUrl]);

  useEffect(() => {
    if (!selectedFile && maximizedPanel === 'file') setMaximizedPanel(null);
    if (selectedFile && activeMobileTab === 'files') setActiveMobileTab('preview');
  }, [selectedFile, maximizedPanel]);

  const contextOptions = useMemo(() => {
    const folders = files
      .filter((f) => f.type === 'tree')
      .map((f) => ({ path: f.path, type: 'folder' as const }))
      .slice(0, 30);

    const docs = files
      .filter((f) => f.type === 'blob' && /\.(md|txt)$/i.test(f.path))
      .map((f) => ({ path: f.path, type: 'file' as const }))
      .slice(0, 60);

    return [...folders, ...docs];
  }, [files]);

  const defaultContextAppliedRepoRef = useRef<string | null>(null);

  useEffect(() => {
    if (!repoUrl) {
      defaultContextAppliedRepoRef.current = null;
      setSelectedContextTargets([]);
      return;
    }

    if (defaultContextAppliedRepoRef.current === repoUrl || contextOptions.length === 0) return;

    const aulaFiles = contextOptions
      .filter((option) =>
        option.type === 'file' && (
          option.path.toLowerCase().startsWith('aulas/') ||
          option.path.toLowerCase().startsWith('aula/') ||
          option.path.toLowerCase().includes('/aulas/') ||
          option.path.toLowerCase().includes('/aula/')
        )
      )
      .map((option) => option.path);

    const namedRaAulaFiles = aulaFiles
      .map((path) => {
        const match = path.match(/RA(\d+)\.md$/i);
        return match ? { path, index: Number(match[1]) } : null;
      })
      .filter((entry): entry is { path: string; index: number } => entry !== null)
      .sort((a, b) => a.index - b.index)
      .slice(-2)
      .map((entry) => entry.path);

    const defaultAulaFiles = (namedRaAulaFiles.length > 0
      ? namedRaAulaFiles
      : aulaFiles.slice(-2));

    setSelectedContextTargets(defaultAulaFiles);
    defaultContextAppliedRepoRef.current = repoUrl;
  }, [repoUrl, contextOptions]);

  const selectedContextFiles = useMemo(() => {
    if (selectedContextTargets.length === 0) return [];
    return teachingDocs.filter((doc) =>
      selectedContextTargets.some((target) => doc.path === target || doc.path.startsWith(`${target}/`)),
    );
  }, [teachingDocs, selectedContextTargets]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(console.error);
  }, []);

  // Handlers
  const handleAnalyze = async (url: string) => {
    if (!student) {
      showToast('Faça login para acessar os módulos.', 'info');
      openLogin();
      return;
    }
    setActiveMode('chat');
    await analyzeRepository(url, performInitialAnalysis);
    setActiveMobileTab('chat');
  };

  const handleGenerateReadingSheet = async () => {
    if (!repoUrl || !analysis) return;
    const contextFiles = selectedContextFiles.length > 0 ? selectedContextFiles : selectedFile ? [selectedFile] : [];
    const loadingToastId = showToast('Gerando ficha de leitura...', 'loading', 0);
    try {
      await generateReadingSheet(repoUrl.split('github.com/')[1], contextFiles);
      hideToast(loadingToastId);
      showToast('Ficha de leitura gerada com sucesso!', 'success');
      setActiveMobileTab('chat');
    } catch (err: any) {
      hideToast(loadingToastId);
      const msg = err.message || 'Falha ao gerar ficha de leitura.';
      setRepoError(msg);
      showToast(msg, 'error');
    }
  };

  const handleOpenQuiz = () => {
    setActiveMode('quiz');
    setActiveMobileTab('quiz');
    setIsSidebarOpen(false);
  };

  const handleOpenLive = () => {
    setActiveMode('live');
    setActiveMobileTab('live');
    setIsSidebarOpen(false);
  };

  const handleBackToChat = () => {
    setActiveMode('chat');
    setActiveMobileTab('chat');
  };

  const handleQuizFinished = useCallback(async (
    score: number,
    total: number,
    percentage: number,
    questions: QuizQuestion[],
    answers: (number | null)[],
  ) => {
    const repoSlug = repoUrl?.split('github.com/')[1];
    await saveQuizResult(score, total, percentage, repoSlug, questions, answers);
  }, [repoUrl, saveQuizResult]);

  const repositoryName = (() => {
    if (!repoUrl) return undefined;
    const cleanUrl = repoUrl.replace(/\.git\/?$/, '').replace(/\/$/, '');
    const match = cleanUrl.match(/github\.com\/[^/]+\/([^/]+)/);
    return match?.[1] || cleanUrl.split('/').pop();
  })();

  const currentRepoFullName = (() => {
    if (!repoUrl) return undefined;
    const cleanUrl = repoUrl.replace(/\.git\/?$/, '').replace(/\/$/, '');
    const match = cleanUrl.match(/github\.com\/([^/]+\/[^/]+)/);
    return match?.[1];
  })();

  const handleFileSelect = async (path: string) => {
    await selectFile(path);
    setIsSidebarOpen(false);
    setActiveMobileTab('preview');
  };

  const currentApiKey = apiKeys.length > 0 ? apiKeys[keyIndex] : undefined;

  // Sidebar buttons shared content
  const SidebarButtons = () => (
    <div className="flex flex-col gap-2">
      <button onClick={clearRepository} className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
        ← Analisar outro
      </button>
      <button
        onClick={handleGenerateReadingSheet}
        disabled={isGeneratingReadingSheet}
        className="text-[10px] bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded px-2 py-1 flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
      >
        {isGeneratingReadingSheet ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
        Ficha de Leitura
      </button>
      <button
        onClick={activeMode === 'quiz' ? handleBackToChat : handleOpenQuiz}
        disabled={selectedContextFiles.length === 0}
        className={cn(
          'text-[10px] border rounded px-2 py-1 flex items-center justify-center gap-2 transition-colors disabled:opacity-40',
          activeMode === 'quiz'
            ? 'bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border-emerald-500/30'
            : 'bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border-indigo-500/30'
        )}
      >
        <BookOpen className="w-3 h-3" />
        {activeMode === 'quiz' ? 'Voltar ao Chat' : 'Testar Conhecimento'}
      </button>

      {/* Live voice button */}
      <button
        onClick={activeMode === 'live' ? handleBackToChat : handleOpenLive}
        className={cn(
          'text-[10px] border rounded px-2 py-1 flex items-center justify-center gap-2 transition-colors',
          activeMode === 'live'
            ? 'bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 border-violet-500/30'
            : 'bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border-indigo-500/30'
        )}
      >
        <Radio className="w-3 h-3" />
        {activeMode === 'live' ? 'Voltar ao Chat' : 'Conversa ao Vivo'}
      </button>
    </div>
  );

  const extractRA = useCallback((path: string) => {
    const match = path.match(/RA(\d+)/i);
    return match ? Number.parseInt(match[1], 10) : null;
  }, []);

  const [contextQuery, setContextQuery] = useState('');
  const [contextCollapsed, setContextCollapsed] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState({ folders: false, learning: false, docs: false });

  const filteredContextOptions = useMemo(() => {
    if (!contextQuery.trim()) return contextOptions;
    const normalized = contextQuery.toLowerCase();
    return contextOptions.filter((option) => option.path.toLowerCase().includes(normalized));
  }, [contextOptions, contextQuery]);

  const groupedContext = useMemo(() => {
    const folders = filteredContextOptions.filter((option) => option.type === 'folder');
    const learning = filteredContextOptions
      .filter((option) => option.type === 'file' && extractRA(option.path) !== null)
      .sort((a, b) => (extractRA(a.path) ?? 0) - (extractRA(b.path) ?? 0));
    const docs = filteredContextOptions.filter(
      (option) => option.type === 'file' && extractRA(option.path) === null,
    );
    return { folders, learning, docs };
  }, [extractRA, filteredContextOptions]);

  const allContextPaths = useMemo(() => contextOptions.map((option) => option.path), [contextOptions]);
  const allContextSelected =
    allContextPaths.length > 0 && allContextPaths.every((path) => selectedContextTargets.includes(path));

  const toggleContextOption = (path: string, checked: boolean) => {
    setSelectedContextTargets((prev) => {
      if (checked) return prev.includes(path) ? prev : [...prev, path];
      return prev.filter((item) => item !== path);
    });
  };

  const toggleGroupCollapse = (group: keyof typeof collapsedGroups) => {
    setCollapsedGroups((prev) => ({ ...prev, [group]: !prev[group] }));
  };

  const GroupHeader = ({
    id,
    label,
    count,
    selected,
  }: {
    id: keyof typeof collapsedGroups;
    label: string;
    count: number;
    selected: number;
  }) => (
    <button
      onClick={() => toggleGroupCollapse(id)}
      className="w-full flex items-center justify-between text-[10px] uppercase tracking-wider text-gray-500"
    >
      <div className="flex items-center gap-2">
        <span className="font-semibold">{label}</span>
        <span className="text-[9px] text-gray-600">{selected}/{count}</span>
      </div>
      <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', collapsedGroups[id] && '-rotate-90')} />
    </button>
  );

  const ContextSelector = () => (
    <div className="mb-4 rounded-xl border border-white/10 bg-[#0f0f0f] overflow-hidden">
      <button
        onClick={() => setContextCollapsed((value) => !value)}
        className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-400" />
          <span className="text-[11px] font-semibold text-gray-300 uppercase tracking-wider">Contexto para IA</span>
          {selectedContextFiles.length > 0 && (
            <span className="text-[9px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/25 px-1.5 py-0.5 rounded-full tabular-nums">
              {selectedContextFiles.length} arq.
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {selectedContextTargets.length > 0 && !contextCollapsed && (
            <button
              onClick={(event) => {
                event.stopPropagation();
                setSelectedContextTargets([]);
              }}
              className="text-[10px] text-gray-500 hover:text-red-400"
            >
              Limpar
            </button>
          )}
          <ChevronDown className={cn('w-3.5 h-3.5 text-gray-600 transition-transform', contextCollapsed && '-rotate-90')} />
        </div>
      </button>

      {!contextCollapsed && (
        <div className="px-3 pb-3 space-y-2.5">
          <p className="text-[10px] text-gray-600">
            Selecione pastas e documentos para respostas mais objetivas.
          </p>

          <div className="flex gap-1.5">
            <div className="relative flex-1">
              <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-gray-600" />
              <input
                value={contextQuery}
                onChange={(event) => setContextQuery(event.target.value)}
                placeholder="Filtrar contexto"
                className="w-full h-7 rounded-lg bg-black/30 border border-white/10 pl-7 pr-2 text-[10px] text-gray-300 outline-none focus:border-indigo-500/40"
              />
            </div>
            <button
              onClick={() => setSelectedContextTargets(allContextSelected ? [] : allContextPaths)}
              className={cn(
                'h-7 px-2 rounded-lg border text-[10px] transition-colors inline-flex items-center gap-1',
                allContextSelected
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                  : 'bg-white/5 border-white/10 text-gray-400 hover:text-gray-200',
              )}
            >
              <CheckCheck className="w-3 h-3" />
              Tudo
            </button>
          </div>

          <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
            {groupedContext.folders.length > 0 && (
              <div className="space-y-1.5">
                <GroupHeader
                  id="folders"
                  label="Pastas"
                  count={groupedContext.folders.length}
                  selected={groupedContext.folders.filter((item) => selectedContextTargets.includes(item.path)).length}
                />
                {!collapsedGroups.folders && (
                  <div className="flex flex-wrap gap-1.5">
                    {groupedContext.folders.map((option) => {
                      const selected = selectedContextTargets.includes(option.path);
                      return (
                        <button
                          key={option.path}
                          onClick={() => toggleContextOption(option.path, !selected)}
                          className={cn(
                            'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[10px] transition-colors',
                            selected
                              ? 'bg-indigo-500/15 border-indigo-500/35 text-indigo-200'
                              : 'bg-white/5 border-white/10 text-gray-400 hover:text-gray-200',
                          )}
                        >
                          <FolderOpen className="w-3 h-3" />
                          <span className="truncate max-w-[110px]">{option.path.split('/').pop() ?? option.path}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {groupedContext.learning.length > 0 && (
              <div className="space-y-1.5">
                <GroupHeader
                  id="learning"
                  label="Resultados de Aprendizagem"
                  count={groupedContext.learning.length}
                  selected={groupedContext.learning.filter((item) => selectedContextTargets.includes(item.path)).length}
                />
                {!collapsedGroups.learning && (
                  <div className="flex flex-wrap gap-1.5">
                    {groupedContext.learning.map((option) => {
                      const selected = selectedContextTargets.includes(option.path);
                      const ra = extractRA(option.path);
                      return (
                        <button
                          key={option.path}
                          onClick={() => toggleContextOption(option.path, !selected)}
                          title={option.path}
                          className={cn(
                            'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[10px] transition-colors',
                            selected
                              ? 'bg-violet-500/15 border-violet-500/35 text-violet-200'
                              : 'bg-white/5 border-white/10 text-gray-400 hover:text-gray-200',
                          )}
                        >
                          <span className="px-1 rounded bg-black/30 text-[9px] font-bold">RA{ra}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {groupedContext.docs.length > 0 && (
              <div className="space-y-1.5">
                <GroupHeader
                  id="docs"
                  label="Documentos"
                  count={groupedContext.docs.length}
                  selected={groupedContext.docs.filter((item) => selectedContextTargets.includes(item.path)).length}
                />
                {!collapsedGroups.docs && (
                  <div className="flex flex-wrap gap-1.5">
                    {groupedContext.docs.map((option) => {
                      const selected = selectedContextTargets.includes(option.path);
                      return (
                        <button
                          key={option.path}
                          onClick={() => toggleContextOption(option.path, !selected)}
                          title={option.path}
                          className={cn(
                            'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[10px] transition-colors',
                            selected
                              ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-200'
                              : 'bg-white/5 border-white/10 text-gray-400 hover:text-gray-200',
                          )}
                        >
                          <FileText className="w-3 h-3" />
                          <span className="truncate max-w-[130px]">{option.path.split('/').pop() ?? option.path}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {filteredContextOptions.length === 0 && (
              <p className="text-[10px] text-gray-500">Nenhum resultado para a busca atual.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#0a0a0a] text-gray-100 font-sans selection:bg-indigo-500/30">
      <Header
        apiKeys={apiKeys}
        keyIndex={keyIndex}
        onUploadKeys={handleKeyFileUpload}
        onLogoClick={clearRepository}
        student={student}
        isStudentLoading={isStudentLoading}
        onOpenStudentDashboard={openDashboard}
        onOpenStudentProfile={openSignup}
        onOpenStudentLogin={openLogin}
      />

      <main className="flex-1 w-full p-0 md:p-6 overflow-hidden relative">
        <AnimatePresence mode="wait">
          {!repoUrl ? (
            <div className="h-full overflow-y-auto p-4 md:p-0">
              <RepoInput
                key="input"
                onAnalyze={handleAnalyze}
                isLoading={isRepoLoading}
                requiresLogin={!student}
                onRequireLogin={() => { showToast('Faça login para acessar os módulos.', 'info'); openLogin(); }}
              />
            </div>
          ) : (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col lg:grid lg:grid-cols-12 gap-6 h-full p-4 md:p-0"
            >
              {/* Desktop Sidebar */}
              <div className={cn(
                'hidden lg:flex bg-[#111] rounded-xl border border-white/10 p-4 h-full overflow-hidden flex-col transition-all duration-300',
                maximizedPanel ? 'hidden' : (selectedFile ? 'lg:col-span-2' : 'lg:col-span-3')
              )}>
                <div className="mb-4 pb-4 border-b border-white/10">
                  <h2 className="font-semibold truncate text-sm" title={repoUrl}>{repoUrl.split('github.com/')[1]}</h2>
                  <div className="mt-2"><SidebarButtons /></div>
                </div>
                <FileTree files={files} onSelect={handleFileSelect} />
              </div>

              {/* Mobile Sidebar Overlay */}
              <AnimatePresence>
                {isSidebarOpen && (
                  <>
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsSidebarOpen(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] lg:hidden" />
                    <motion.div
                      initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
                      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                      className="fixed left-0 top-0 bottom-0 w-[80%] max-w-xs bg-[#111] z-[61] p-4 border-r border-white/10 flex flex-col lg:hidden"
                    >
                      <div className="flex items-center justify-between mb-6">
                        <span className="font-bold text-indigo-400">Arquivos</span>
                        <button onClick={() => setIsSidebarOpen(false)} className="p-1 hover:bg-white/5 rounded"><CloseIcon className="w-5 h-5" /></button>
                      </div>
                      <div className="mb-6">
                        <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                          <h2 className="font-semibold truncate text-xs text-gray-300 mb-2">{repoUrl.split('github.com/')[1]}</h2>
                          <SidebarButtons />
                        </div>
                      </div>
                      <div className="flex-1 overflow-hidden flex flex-col">
                        <FileTree files={files} onSelect={handleFileSelect} />
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>

              {/* Main Content */}
              <div className={cn(
                'h-full flex flex-col gap-4 transition-all duration-300 pb-16 lg:pb-0',
                maximizedPanel === 'chat' ? 'lg:col-span-12' : (selectedFile ? 'lg:col-span-5' : 'lg:col-span-9'),
                maximizedPanel === 'file' ? 'hidden' : (
                  activeMobileTab !== 'chat' && activeMobileTab !== 'quiz' && activeMobileTab !== 'live'
                    ? 'hidden lg:flex'
                    : 'flex'
                )
              )}>
                {repoError && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-300 p-3 rounded-xl text-xs relative overflow-hidden">
                    <span>Erro: {repoError}</span>
                    <div className="absolute bottom-0 left-0 h-0.5 bg-red-500/50 animate-[shrink_5s_linear_forwards]" style={{ width: '100%' }} />
                  </div>
                )}

                <AnimatePresence mode="wait">
                  {activeMode === 'quiz' ? (
                    <motion.div key="quiz-panel" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="flex-1 min-h-0">
                      <QuizInterface
                        allFiles={selectedContextFiles}
                        apiKey={currentApiKey}
                        onBack={handleBackToChat}
                        onQuizFinished={handleQuizFinished}
                      />
                    </motion.div>
                  ) : activeMode === 'live' ? (
                    <motion.div key="live-panel" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="flex-1 min-h-0">
                      <LiveVoicePanel
                        contextFiles={selectedContextFiles}
                        apiKey={currentApiKey}
                        onBack={handleBackToChat}
                      />
                    </motion.div>
                  ) : (
                    <motion.div key="chat-panel" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="flex-1 min-h-0">
                      <ChatInterface
                        messages={chatHistory}
                        onSendMessage={(msg) => sendMessage(msg, selectedContextFiles)}
                        isThinking={isThinking}
                        showThinkingState={isWaitingForFirstChunk}
                        processLogs={processLogs}
                        isMaximized={maximizedPanel === 'chat'}
                        onToggleMaximize={() => setMaximizedPanel(prev => prev === 'chat' ? null : 'chat')}
                        repositoryName={repositoryName}
                        repositoryDescription={repoDescription}
                        onTranscribeAudio={transcribeAudioMessage}
                        isTranscribingAudio={isTranscribingAudio}
                        onSynthesizeAudio={synthesizeMessageAudio}
                        isSynthesizingAudio={isSynthesizingAudio}
                        contextSelector={<ContextSelector />}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* File Preview */}
              <AnimatePresence>
                {selectedFile && (maximizedPanel === 'file' || !maximizedPanel) && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                    className={cn('h-full pb-16 lg:pb-0',
                      maximizedPanel === 'file' ? 'lg:col-span-12' : 'lg:col-span-5',
                      activeMobileTab !== 'preview' ? 'hidden lg:block' : 'block'
                    )}
                  >
                    <FileViewer
                      file={selectedFile}
                      onClose={() => setSelectedFile(null)}
                      isMaximized={maximizedPanel === 'file'}
                      onToggleMaximize={() => setMaximizedPanel(prev => prev === 'file' ? null : 'file')}
                      onBack={navigateBack}
                      onForward={navigateForward}
                      canGoBack={currentHistoryIndex > 0}
                      canGoForward={currentHistoryIndex < fileHistory.length - 1}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Mobile Navigation */}
              <div className="fixed bottom-0 left-0 right-0 h-16 bg-[#111] border-t border-white/10 flex items-center justify-around px-4 lg:hidden z-50">
                <button onClick={() => setIsSidebarOpen(true)} className="flex flex-col items-center gap-1 text-gray-400 hover:text-white transition-colors">
                  <Menu className="w-5 h-5" /><span className="text-[10px]">Menu</span>
                </button>
                <button onClick={() => { setActiveMobileTab('chat'); setActiveMode('chat'); }}
                  className={cn('flex flex-col items-center gap-1 transition-colors', activeMobileTab === 'chat' ? 'text-indigo-400' : 'text-gray-400')}
                >
                  <MessageSquare className="w-5 h-5" /><span className="text-[10px]">Chat</span>
                </button>
                <button onClick={handleOpenQuiz} disabled={selectedContextFiles.length === 0}
                  className={cn('flex flex-col items-center gap-1 transition-colors',
                    activeMobileTab === 'quiz' ? 'text-emerald-400' : 'text-gray-400 hover:text-white',
                    selectedContextFiles.length === 0 && 'opacity-40 cursor-not-allowed'
                  )}
                >
                  <BookOpen className="w-5 h-5" /><span className="text-[10px]">Testar</span>
                </button>
                <button onClick={handleOpenLive}
                  className={cn('flex flex-col items-center gap-1 transition-colors',
                    activeMobileTab === 'live' ? 'text-violet-400' : 'text-gray-400 hover:text-white'
                  )}
                >
                  <Radio className="w-5 h-5" /><span className="text-[10px]">Ao Vivo</span>
                </button>
                {selectedFile && (
                  <button onClick={() => setActiveMobileTab('preview')}
                    className={cn('flex flex-col items-center gap-1 transition-colors', activeMobileTab === 'preview' ? 'text-indigo-400' : 'text-gray-400')}
                  >
                    <Eye className="w-5 h-5" /><span className="text-[10px]">Preview</span>
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* ── Gamification overlays ── */}
      <StudentProfileModal
        isOpen={isProfileOpen}
        mode={authMode}
        onClose={closeProfile}
        onSignUp={createProfile}
        onLogin={loginWithAccessCode}
        onRecoverAccessCode={recoverAccessCode}
        onSaveEdit={(name, email, cls, gender) => updateProfile({ name, email, class: cls, gender })}
        onSwitchToSignUp={openSignup}
        existingStudent={student}
        isLoading={isStudentLoading}
        lastAccessCode={lastAccessCode}
      />

      <StudentDashboard
        isOpen={isDashboardOpen}
        onClose={closeDashboard}
        student={student!}
        ranking={ranking}
        repoRanking={repoRanking}
        quizHistory={quizHistory}
        isLoadingHistory={isLoadingHistory}
        currentRepoFullName={currentRepoFullName}
        onEditProfile={() => { closeDashboard(); openProfile(); }}
        onLoadRanking={loadRanking}
        onLoadHistory={loadQuizHistory}
      />

      <AnimatePresence>
        {levelUpInfo && (
          <LevelUpToast
            from={levelUpInfo.from as any}
            to={levelUpInfo.to as any}
            xp={levelUpInfo.xp}
            onDismiss={() => {}}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
