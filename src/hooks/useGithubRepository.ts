// src/hooks/useGithubRepository.ts
// Alteração: AnalyzeRepositoryFn agora aceita repoFullName opcional (2º parâmetro)
// para que a ingestão no Supabase saiba em qual repositório filtrar.

import { useState, useCallback, startTransition, useRef, useEffect } from 'react';
import { FileNode, RepositoryFile } from '@/types';
import { githubApi } from '@/services/github.api';

const TEACHING_DOC_REGEX = /\.(md|txt)$/i;
const MAX_TEACHING_DOCS = 15;
const REPO_UPDATE_POLL_INTERVAL_MS = 5 * 60 * 1000;

// Adicionado repoFullName opcional como 2º parâmetro
type AnalyzeRepositoryFn = (
  files: { path: string; content: string }[],
  repoFullName?: string,
) => Promise<string>;

export function useGithubRepository(onRepositoryUpdated?: () => void) {
  const [repoUrl, setRepoUrl] = useState<string | null>(null);
  const [files, setFiles] = useState<FileNode[]>([]);
  const [branch, setBranch] = useState<string>('main');
  const [repoDescription, setRepoDescription] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setErrorRaw] = useState<string | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedFile, setSelectedFile] = useState<RepositoryFile | null>(null);
  const [teachingDocs, setTeachingDocs] = useState<RepositoryFile[]>([]);
  const [headSha, setHeadSha] = useState<string | null>(null);
  const analysisFnRef = useRef<AnalyzeRepositoryFn | null>(null);

  // History
  const [fileHistory, setFileHistory] = useState<RepositoryFile[]>([]);
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState(-1);

  const setError = useCallback((msg: string | null, duration = 5000) => {
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    setErrorRaw(msg);
    if (msg && duration > 0) {
      errorTimerRef.current = setTimeout(() => setErrorRaw(null), duration);
    }
  }, []);

  useEffect(() => () => {
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
  }, []);

  const analyzeRepository = useCallback(async (
    url: string,
    performAnalysis: AnalyzeRepositoryFn,
    options?: { silent?: boolean },
  ) => {
    if (!options?.silent) setIsLoading(true);
    setError(null);
    setRepoUrl(url);
    setTeachingDocs([]);
    setRepoDescription(null);
    analysisFnRef.current = performAnalysis;

    try {
      const cleanUrl = url.replace(/\.git\/?$/, '').replace(/\/$/, '');
      const match = cleanUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
      if (!match) throw new Error('URL do GitHub inválida. Use o formato: https://github.com/usuario/repo');
      const [, owner, repo] = match;
      const repoFullName = `${owner}/${repo}`;

      const treeData = await githubApi.getTree(owner, repo);
      const allNodes = treeData.tree;

      startTransition(() => { setFiles(allNodes); });

      const currentBranch = treeData.branch || 'main';
      const currentHeadSha = treeData.headSha || null;
      setBranch(currentBranch);
      setHeadSha(currentHeadSha);
      setRepoDescription(treeData.description || null);

      const priorityFiles = allNodes.filter((f) =>
        f.type === 'blob' &&
        f.path.match(/(README|package\.json|tsconfig\.json|src\/main|src\/App|server\.ts|\.py|\.js|\.tsx)$/i),
      ).slice(0, 5);

      const fileContents = await Promise.all(
        priorityFiles.map(async (f) => ({
          path: f.path,
          content: await githubApi.getFileContent(owner, repo, f.path, currentBranch),
        })),
      );

      const docFiles = allNodes
        .filter((f) => f.type === 'blob' && TEACHING_DOC_REGEX.test(f.path))
        .slice(0, MAX_TEACHING_DOCS);

      const docsLoaded = await Promise.allSettled(
        docFiles.map(async (f) => ({
          path: f.path,
          content: await githubApi.getFileContent(owner, repo, f.path, currentBranch),
        })),
      );

      const availableDocs = docsLoaded
        .filter((r): r is PromiseFulfilledResult<{ path: string; content: string }> => r.status === 'fulfilled')
        .map((r) => r.value)
        .filter((d) => d.content.trim().length > 0);

      setTeachingDocs(availableDocs);

      // Passa repoFullName para que useAIChat possa usá-lo na ingestão e no filtro
      await performAnalysis([...fileContents, ...availableDocs], repoFullName);

      return { owner, repo, allFiles: allNodes, branch: currentBranch };
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Ocorreu um erro ao buscar o repositório.');
    } finally {
      if (!options?.silent) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!repoUrl || !branch || !headSha || !analysisFnRef.current) return;

    const cleanUrl = repoUrl.replace(/\.git\/?$/, '').replace(/\/$/, '');
    const match = cleanUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) return;
    const [, owner, repo] = match;

    const checkForUpdates = async () => {
      try {
        const latestHeadSha = await githubApi.getHeadSha(owner, repo, branch);
        if (latestHeadSha === headSha || !analysisFnRef.current) return;
        githubApi.clearCache();
        onRepositoryUpdated?.();
        await analyzeRepository(repoUrl, analysisFnRef.current, { silent: true });
      } catch (err) {
        console.error('Falha ao verificar atualizações do repositório:', err);
      }
    };

    const interval = setInterval(checkForUpdates, REPO_UPDATE_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [repoUrl, branch, headSha, analyzeRepository, onRepositoryUpdated]);

  const selectFile = useCallback(async (path: string) => {
    if (!repoUrl) return;
    if (selectedFile && selectedFile.path === path) return;

    try {
      const cleanUrl = repoUrl.replace(/\.git\/?$/, '').replace(/\/$/, '');
      const match = cleanUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
      if (!match) return;
      const [, owner, repo] = match;

      const isPdf = /\.pdf$/i.test(path);
      const content = isPdf ? '' : await githubApi.getFileContent(owner, repo, path, branch);
      const encodedPath = path.split('/').map((segment) => encodeURIComponent(segment)).join('/');
      const newFile: RepositoryFile = {
        path,
        content,
        rawUrl: `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${encodedPath}`,
      };
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
    setRepoDescription(null);
    setHeadSha(null);
    setFileHistory([]);
    setCurrentHistoryIndex(-1);
    githubApi.clearCache();
  }, []);

  return {
    repoUrl,
    files,
    repoDescription,
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
    setError,
  };
}
