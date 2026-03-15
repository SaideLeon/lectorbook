import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Github, Search, Loader2, Lock, Unlock, Star, GitFork, RefreshCw, Filter } from 'lucide-react';
import { githubApi } from '@/services/github.api';

export const RepoInput = ({ onAnalyze, isLoading }: { onAnalyze: (url: string) => void, isLoading: boolean }) => {
  const [userRepos, setUserRepos] = useState<any[]>([]);
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [repoError, setRepoError] = useState<string | null>(null);
  const [repoSearch, setRepoSearch] = useState('');
  const [showAllRepos, setShowAllRepos] = useState(false);

  useEffect(() => {
    loadUserRepos();
  }, []);

  const loadUserRepos = async () => {
    setIsLoadingRepos(true);
    setRepoError(null);
    try {
      const repos = await githubApi.getUserRepos();
      setUserRepos(repos);
    } catch (error: any) {
      console.error("Failed to load repos", error);
      setRepoError(error.message || "Falha ao buscar repositórios");
    } finally {
      setIsLoadingRepos(false);
    }
  };

  const filteredRepos = useMemo(() => {
    return userRepos.filter(repo => 
      repo.full_name.toLowerCase().includes(repoSearch.toLowerCase()) ||
      (repo.description && repo.description.toLowerCase().includes(repoSearch.toLowerCase()))
    );
  }, [userRepos, repoSearch]);

  const displayedRepos = showAllRepos ? filteredRepos : filteredRepos.slice(0, 6);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 py-12">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-5xl w-full space-y-12"
      >
        <div className="space-y-4">
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight bg-gradient-to-r from-white to-gray-500 bg-clip-text text-transparent">
            Lectorbook
          </h1>
          <p className="text-gray-400 text-base md:text-lg max-w-2xl mx-auto">
            Acompanhe de perto a minha jornada no Curso de Contabilidade CV3: cada desafio, aprendizado e conquista enquanto construo meu conhecimento na área financeira e contábil.
          </p>
        </div>

        <div className="max-w-2xl mx-auto text-sm text-gray-400 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
          A análise agora aceita apenas repositórios internos listados abaixo, com base no token do GitHub configurado.
        </div>
        

          <div className="mt-16 pt-12 border-t border-white/5 space-y-8">
            <div className="space-y-2">
              <p className="text-xs text-gray-500">
                Para usar os recursos de IA, gere sua API Key no AI Studio: <a href="https://aistudio.google.com/api-keys" target="_blank" rel="noreferrer" className="font-mono text-indigo-400 hover:text-indigo-300 underline">https://aistudio.google.com/api-keys</a>.
              </p>
              <p className="text-xs text-gray-500">
                Consulte também nossas <a href="/politicas" className="text-indigo-400 hover:text-indigo-300 underline">Políticas de Uso e Privacidade</a>.
              </p>
            </div>
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                <Github className="w-6 h-6 text-indigo-400" />
                Seus Repositórios
              </h3>
              
              <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="relative flex-1 md:w-64">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input 
                    type="text"
                    value={repoSearch}
                    onChange={(e) => setRepoSearch(e.target.value)}
                    placeholder="Pesquisar repositórios internos..."
                    className="w-full bg-[#111] border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                  />
                </div>
                <button 
                  onClick={loadUserRepos}
                  disabled={isLoadingRepos}
                  className="p-2 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 text-gray-400 hover:text-white transition-all disabled:opacity-50"
                  title="Atualizar lista"
                >
                  <RefreshCw className={repoSearch ? "" : (isLoadingRepos ? "animate-spin" : "") + " w-4 h-4"} />
                </button>
              </div>
            </div>
            
            {isLoadingRepos ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
                <p className="text-gray-500 text-sm animate-pulse">Sincronizando com o GitHub...</p>
              </div>
            ) : repoError ? (
              <div className="flex flex-col items-center justify-center py-10 gap-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                <p className="text-red-400 text-sm font-medium">{repoError}</p>
                <button 
                  onClick={loadUserRepos}
                  className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg text-sm transition-colors"
                >
                  Tentar novamente
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-left">
                  <AnimatePresence mode="popLayout">
                    {displayedRepos.map((repo) => (
                      <motion.button
                        layout
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        key={repo.id}
                        onClick={() => onAnalyze(repo.html_url)}
                        disabled={isLoading}
                        className="group flex flex-col gap-3 p-5 bg-[#111] border border-white/5 hover:border-indigo-500/50 rounded-xl transition-all hover:bg-white/5 relative overflow-hidden disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Search className="w-4 h-4 text-indigo-400" />
                        </div>
                        
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-2 min-w-0">
                            {repo.private ? (
                              <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            ) : (
                              <Unlock className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                            )}
                            <span className="font-semibold text-sm truncate text-gray-100 group-hover:text-indigo-300 transition-colors">
                              {repo.name}
                            </span>
                          </div>
                        </div>
                        
                        <p className="text-xs text-gray-500 line-clamp-2 h-8 leading-relaxed">
                          {repo.description || "Sem descrição disponível"}
                        </p>
                        
                        <div className="flex items-center gap-4 text-[10px] font-medium text-gray-500 mt-auto pt-3 border-t border-white/5">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                            {repo.language || 'N/A'}
                          </div>
                          <div className="flex items-center gap-1">
                            <Star className="w-3 h-3 text-amber-500/50" />
                            {repo.stargazers_count}
                          </div>
                          <div className="flex items-center gap-1">
                            <GitFork className="w-3 h-3 text-gray-600" />
                            {repo.forks_count}
                          </div>
                        </div>
                      </motion.button>
                    ))}
                  </AnimatePresence>
                </div>

                {filteredRepos.length > 6 && (
                  <button
                    onClick={() => setShowAllRepos(!showAllRepos)}
                    className="text-sm font-medium text-indigo-400 hover:text-indigo-300 transition-colors py-2 px-4 rounded-lg bg-indigo-500/5 hover:bg-indigo-500/10 border border-indigo-500/20"
                  >
                    {showAllRepos ? "Mostrar menos" : `Ver todos os ${filteredRepos.length} repositórios`}
                  </button>
                )}

                {filteredRepos.length === 0 && !isLoadingRepos && (
                  <div className="py-20 text-center space-y-2">
                    <Github className="w-12 h-12 text-gray-800 mx-auto mb-4" />
                    <p className="text-gray-400 font-medium">Nenhum repositório corresponde à sua busca.</p>
                    <p className="text-gray-600 text-sm">Tente termos mais genéricos ou limpe o filtro.</p>
                  </div>
                )}
              </div>
            )}
          </div>
      </motion.div>
    </div>
  );
};
