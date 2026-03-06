import { useState, useCallback, startTransition } from 'react';
import { FileNode, SelectedFile } from '@/types';
import { githubApi } from '@/services/github.api';

export function useGithubRepository() {
  const [repoUrl, setRepoUrl] = useState<string | null>(null);
  const [files, setFiles] = useState<FileNode[]>([]);
  const [branch, setBranch] = useState<string>('main');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
  
  // History
  const [fileHistory, setFileHistory] = useState<SelectedFile[]>([]);
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState(-1);

  const analyzeRepository = useCallback(async (url: string, performAnalysis: (files: { path: string, content: string }[]) => Promise<string>) => {
    setIsLoading(true);
    setError(null);
    setRepoUrl(url);
    
    try {
      const cleanUrl = url.replace(/\.git\/?$/, "").replace(/\/$/, "");
      const match = cleanUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
      if (!match) throw new Error("URL do GitHub inválida. Use o formato: https://github.com/usuario/repo");
      const [, owner, repo] = match;

      const treeData = await githubApi.getTree(owner, repo);
      // We keep all nodes (trees and blobs) for the file explorer
      const allNodes = treeData.tree;
      
      // Use startTransition for potentially expensive UI updates
      startTransition(() => {
          setFiles(allNodes);
      });

      const currentBranch = treeData.branch || 'main';
      setBranch(currentBranch);
      
      // Fetch key files for initial analysis
      // Filter for blobs only
      const priorityFiles = allNodes.filter((f) => 
        f.type === 'blob' && f.path.match(/(README|package\.json|tsconfig\.json|src\/main|src\/App|server\.ts|\.py|\.js|\.tsx)$/i)
      ).slice(0, 5);

      const fileContents = await Promise.all(priorityFiles.map(async (f) => {
        const textFile = await githubApi.getTextFile(owner, repo, f.path, currentBranch);
        return { path: f.path, content: textFile.content || '' };
      }));

      await performAnalysis(fileContents);
      
      return { owner, repo, allFiles: allNodes, branch: currentBranch };
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Ocorreu um erro ao buscar o repositório.");
      // throw err; // Don't throw, just set error state
    } finally {
      setIsLoading(false);
    }
  }, []);

  const selectFile = useCallback(async (path: string) => {
    if (!repoUrl) return;
    
    if (selectedFile && selectedFile.path === path) return;

    try {
      const cleanUrl = repoUrl.replace(/\.git\/?$/, "").replace(/\/$/, "");
      const match = cleanUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
      if (!match) return;
      const [, owner, repo] = match;

      const extension = path.split('.').pop()?.toLowerCase() || '';
      const isPdf = extension === 'pdf';

      const newFile = isPdf
        ? await githubApi.getPdfFile(owner, repo, path, branch)
        : await githubApi.getTextFile(owner, repo, path, branch);

      setSelectedFile(newFile);
      
      const newHistory = fileHistory.slice(0, currentHistoryIndex + 1);
      newHistory.push(newFile);
      setFileHistory(newHistory);
      setCurrentHistoryIndex(newHistory.length - 1);
      
      return newFile;
    } catch (err) {
      console.error(err);
      setError("Falha ao carregar conteúdo do arquivo");
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
    fileHistory,
    currentHistoryIndex,
    analyzeRepository,
    selectFile,
    navigateBack,
    navigateForward,
    clearRepository,
    setSelectedFile, // Exposed for closing file viewer
    setError
  };
}
