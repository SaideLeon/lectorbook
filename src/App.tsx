import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, FileText, MessageSquare, Eye, Menu, X as CloseIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Header } from '@/components/layout/Header';
import { ArticleInput } from '@/components/layout/ArticleInput';
import { ArticleList } from '@/components/article-explorer/ArticleList';
import { ArticleViewer } from '@/components/article-explorer/ArticleViewer';
import { ChatInterface } from '@/components/ai-chat/ChatInterface';
import { useArticleLibrary } from '@/hooks/useArticleLibrary';
import { useAIChat } from '@/hooks/useAIChat';
import { useToast } from '@/components/ui/Toast';

type MobileTab = 'library' | 'chat' | 'preview';

export default function App() {
  const { showToast, hideToast } = useToast();
  const [maximizedPanel, setMaximizedPanel] = useState<'chat' | 'article' | null>(null);
  const [activeMobileTab, setActiveMobileTab] = useState<MobileTab>('chat');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [language, setLanguage] = useState<'pt-BR' | 'EN' | 'ES'>('pt-BR');

  const { currentUrl, articles, isLoading, error, selectedArticle, addArticle, selectArticle, navigateBack, navigateForward, fileHistory, currentHistoryIndex, clearLibrary, setSelectedArticle, setError } = useArticleLibrary();
  const { chatHistory, isThinking, analysis, isGeneratingReport, performInitialAnalysis, sendMessage, generateArticleReport, apiKeys, keyIndex, handleKeyFileUpload } = useAIChat();

  useEffect(() => {
    if (!selectedArticle && maximizedPanel === 'article') setMaximizedPanel(null);
  }, [selectedArticle, maximizedPanel]);

  const handleAnalyze = async (input: string | File) => {
    await addArticle(input, performInitialAnalysis);
    setActiveMobileTab('chat');
  };

  const handleGenerateReport = async () => {
    if (!selectedArticle || !analysis) return;
    const loadingToastId = showToast('Gerando relatório do artigo...', 'loading', 0);
    try {
      await generateArticleReport(selectedArticle);
      hideToast(loadingToastId);
      showToast('Relatório gerado com sucesso!', 'success');
    } catch (err: any) {
      hideToast(loadingToastId);
      const msg = err.message || 'Falha ao gerar relatório.';
      setError(msg);
      showToast(msg, 'error');
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#0a0a0a] text-gray-100 font-sans selection:bg-indigo-500/30">
      <Header apiKeys={apiKeys} keyIndex={keyIndex} onUploadKeys={handleKeyFileUpload} onLogoClick={clearLibrary} language={language} onLanguageChange={setLanguage} />
      <main className="flex-1 w-full p-0 md:p-6 overflow-hidden relative">
        <AnimatePresence mode="wait">
          {!currentUrl && articles.length === 0 ? (
            <div className="h-full overflow-y-auto p-4 md:p-0"><ArticleInput key="input" onAnalyze={handleAnalyze} isLoading={isLoading} recentArticles={articles} /></div>
          ) : (
            <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col lg:grid lg:grid-cols-12 gap-6 h-full p-4 md:p-0">
              <div className={cn('hidden lg:flex bg-[#111] rounded-xl border border-white/10 p-4 h-full overflow-hidden flex-col transition-all duration-300', maximizedPanel ? 'hidden' : (selectedArticle ? 'lg:col-span-2' : 'lg:col-span-3'))}>
                <div className="mb-4 pb-4 border-b border-white/10">
                  <h2 className="font-semibold truncate text-sm">Biblioteca</h2>
                  <div className="flex flex-col gap-2 mt-2">
                    <button onClick={clearLibrary} className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1">← Carregar outro artigo</button>
                    <button onClick={handleGenerateReport} disabled={isGeneratingReport || !selectedArticle} className="text-[10px] bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded px-2 py-1 flex items-center justify-center gap-2 transition-colors disabled:opacity-50">{isGeneratingReport ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}Relatório</button>
                  </div>
                </div>
                <ArticleList articles={articles} selectedId={selectedArticle?.id} onSelect={selectArticle} />
              </div>

              <AnimatePresence>
                {isSidebarOpen && (
                  <>
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsSidebarOpen(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] lg:hidden" />
                    <motion.div initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="fixed left-0 top-0 bottom-0 w-[80%] max-w-xs bg-[#111] z-[61] p-4 border-r border-white/10 flex flex-col lg:hidden">
                      <div className="flex items-center justify-between mb-6"><span className="font-bold text-indigo-400">Artigos</span><button onClick={() => setIsSidebarOpen(false)} className="p-1 hover:bg-white/5 rounded"><CloseIcon className="w-5 h-5" /></button></div>
                      <ArticleList articles={articles} selectedId={selectedArticle?.id} onSelect={(id) => { selectArticle(id); setIsSidebarOpen(false); setActiveMobileTab('preview'); }} />
                    </motion.div>
                  </>
                )}
              </AnimatePresence>

              <div className={cn('h-full flex flex-col gap-4 transition-all duration-300 pb-16 lg:pb-0', maximizedPanel === 'chat' ? 'lg:col-span-12' : (selectedArticle ? 'lg:col-span-5' : 'lg:col-span-9'), maximizedPanel === 'article' ? 'hidden' : (activeMobileTab !== 'chat' ? 'hidden lg:flex' : 'flex'))}>
                {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-xs">Erro: {error}</div>}
                <ChatInterface messages={chatHistory} onSendMessage={sendMessage} isThinking={isThinking} isMaximized={maximizedPanel === 'chat'} onToggleMaximize={() => setMaximizedPanel(prev => prev === 'chat' ? null : 'chat')} />
              </div>

              <AnimatePresence>
                {selectedArticle && (maximizedPanel === 'article' || !maximizedPanel) && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className={cn('h-full pb-16 lg:pb-0', maximizedPanel === 'article' ? 'lg:col-span-12' : 'lg:col-span-5', activeMobileTab !== 'preview' ? 'hidden lg:block' : 'block')}>
                    <ArticleViewer article={selectedArticle} onClose={() => setSelectedArticle(null)} isMaximized={maximizedPanel === 'article'} onToggleMaximize={() => setMaximizedPanel(prev => prev === 'article' ? null : 'article')} onBack={navigateBack} onForward={navigateForward} canGoBack={currentHistoryIndex > 0} canGoForward={currentHistoryIndex < fileHistory.length - 1} />
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="fixed bottom-0 left-0 right-0 h-16 bg-[#111] border-t border-white/10 flex items-center justify-around px-4 lg:hidden z-50">
                <button onClick={() => setIsSidebarOpen(true)} className="flex flex-col items-center gap-1 text-gray-400 hover:text-white"><Menu className="w-5 h-5" /><span className="text-[10px]">Menu</span></button>
                <button onClick={() => setActiveMobileTab('chat')} className={cn('flex flex-col items-center gap-1', activeMobileTab === 'chat' ? 'text-indigo-400' : 'text-gray-400')}><MessageSquare className="w-5 h-5" /><span className="text-[10px]">Chat</span></button>
                {selectedArticle && <button onClick={() => setActiveMobileTab('preview')} className={cn('flex flex-col items-center gap-1', activeMobileTab === 'preview' ? 'text-indigo-400' : 'text-gray-400')}><Eye className="w-5 h-5" /><span className="text-[10px]">Leitura</span></button>}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
