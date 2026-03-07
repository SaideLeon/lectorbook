import { useState, useCallback, startTransition } from 'react';
import { FileNode } from '@/types';
import { githubApi } from '@/services/github.api';

const TEACHING_DOC_REGEX = /\.(md|txt)$/i;
const MAX_TEACHING_DOCS = 15;

export function useGithubRepository() {
  const [repoUrl, setRepoUrl] = useState<string | null>(null);
  const [files, setFiles] = useState<FileNode[]>([]);
  const [branch, setBranch] = useState<string>('main');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<{ path: string, content: string } | null>(null);
  const [teachingDocs, setTeachingDocs] = useState<{ path: string, content: string }[]>([]);
  
  // History
  const [fileHistory, setFileHistory] = useState<{ path: string, content: string }[]>([]);
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState(-1);

  const analyzeRepository = useCallback(async (url: string, performAnalysis: (files: { path: string, content: string }[]) => Promise<string>) => {
    setIsLoading(true);
    setError(null);
    setRepoUrl(url);
    setTeachingDocs([]);
    
    try {
      const cleanUrl = url.replace(/\.git\/?$/, '').replace(/\/$/, '');
      const match = cleanUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
      if (!match) throw new Error('URL do GitHub inválida. Use o formato: https://github.com/usuario/repo');
      const [, owner, repo] = match;

      const treeData = await githubApi.getTree(owner, repo);
      const allNodes = treeData.tree;
      
      startTransition(() => {
        setFiles(allNodes);
      });

      const currentBranch = treeData.branch || 'main';
      setBranch(currentBranch);
      
      // Inicial: mantém análise rápida com arquivos prioritários de código/configuração
      const priorityFiles = allNodes.filter((f) => 
        f.type === 'blob' && f.path.match(/(README|package\.json|tsconfig\.json|src\/main|src\/App|server\.ts|\.py|\.js|\.tsx)$/i)
      ).slice(0, 5);

      const fileContents = await Promise.all(priorityFiles.map(async (f) => {
        const content = await githubApi.getFileContent(owner, repo, f.path, currentBranch);
        return { path: f.path, content };
      }));

      // Carrega automaticamente documentação .md/.txt para suporte ao chat docente
      const docFiles = allNodes
        .filter((f) => f.type === 'blob' && TEACHING_DOC_REGEX.test(f.path))
        .slice(0, MAX_TEACHING_DOCS);

      const docsLoaded = await Promise.allSettled(
        docFiles.map(async (f) => ({
          path: f.path,
          content: await githubApi.getFileContent(owner, repo, f.path, currentBranch)
        }))
      );

      const availableDocs = docsLoaded
        .filter((r): r is PromiseFulfilledResult<{ path: string; content: string }> => r.status === 'fulfilled')
        .map((r) => r.value)
        .filter((d) => d.content.trim().length > 0);

      setTeachingDocs(availableDocs);

      await performAnalysis([...fileContents, ...availableDocs]);
      
      return { owner, repo, allFiles: allNodes, branch: currentBranch };
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Ocorreu um erro ao buscar o repositório.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const selectFile = useCallback(async (path: string) => {
    if (!repoUrl) return;
    
    if (selectedFile && selectedFile.path === path) return;

    try {
      const cleanUrl = repoUrl.replace(/\.git\/?$/, '').replace(/\/$/, '');
      const match = cleanUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
      if (!match) return;
      const [, owner, repo] = match;

      const content = await githubApi.getFileContent(owner, repo, path, branch);
      
      const newFile = { path, content };
      setSelectedFile(newFile);
      
      const newHistory = fileHistory.slice(0, currentHistoryIndex + 1);
      newHistory.push(newFile);
      setFileHistory(newHistory);
      setCurrentHistoryIndex(newHistory.length - 1);
      
      return newFile;
    } catch (err) {
      console.error(err);
      setError('Falha ao carregar conteúdo do arquivo');
    }
  }, [repoUrl, selectedFile, fileHistory, currentHistoryIndex, branch]);

  const navigateBack = useCallback(() => {
    if (currentHistoryIndex > 0) {
      const newIndex = currentHistoryIndex - 1;
      setCurrentHistoryIndex(newIndex);
      setSelectedFile(fileHistory[newIndex]);
    }
  }, [currentHistoryIndex, fileHistory]);

  const navigateForward = useCallback(() => {
    if (currentHistoryIndex < fileHistory.length - 1) {
      const newIndex = currentHistoryIndex + 1;
      setCurrentHistoryIndex(newIndex);
      setSelectedFile(fileHistory[newIndex]);
    }
  }, [currentHistoryIndex, fileHistory]);

  const clearRepository = useCallback(() => {
    setRepoUrl(null);
    setFiles([]);
    setSelectedFile(null);
    setTeachingDocs([]);
    setFileHistory([]);
    setCurrentHistoryIndex(-1);
    githubApi.clearCache();
  }, []);

  return {
    repoUrl,
    files,
    isLoading,
    error,
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
    setError
  };
}
