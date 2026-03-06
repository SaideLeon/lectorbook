import { useCallback, useEffect, useMemo, useState } from 'react';
import { Article, PersonalFile, PersonalRepoConfig } from '@/types';
import { personalLibraryApi } from '@/services/personalLibrary.api';
import { articleApi } from '@/services/article.api';

const PAT_STORAGE_KEY = 'lb_personal_pat';
const REPO_STORAGE_KEY = 'lb_personal_repo';

function decodeBase64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function usePersonalLibrary() {
  const [pat, setPat] = useState<string | null>(null);
  const [repoConfig, setRepoConfig] = useState<PersonalRepoConfig | null>(null);
  const [files, setFiles] = useState<PersonalFile[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isConnected = useMemo(() => Boolean(pat && repoConfig), [pat, repoConfig]);

  useEffect(() => {
    const storedPat = localStorage.getItem(PAT_STORAGE_KEY);
    const storedRepo = localStorage.getItem(REPO_STORAGE_KEY);

    if (storedPat) setPat(storedPat);
    if (!storedRepo) return;

    try {
      const parsedRepo = JSON.parse(storedRepo) as PersonalRepoConfig;
      if (parsedRepo.owner && parsedRepo.repo && parsedRepo.branch) {
        setRepoConfig(parsedRepo);
      }
    } catch {
      localStorage.removeItem(REPO_STORAGE_KEY);
    }
  }, []);

  const loadFiles = useCallback(async () => {
    if (!pat || !repoConfig) return;

    setIsLoadingFiles(true);
    setError(null);

    try {
      const loadedFiles = await personalLibraryApi.getFiles(pat, repoConfig.owner, repoConfig.repo, repoConfig.branch);
      setFiles(loadedFiles);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar arquivos da biblioteca pessoal');
      throw err;
    } finally {
      setIsLoadingFiles(false);
    }
  }, [pat, repoConfig]);

  useEffect(() => {
    if (!isConnected) return;
    loadFiles().catch(() => undefined);
  }, [isConnected, loadFiles]);

  const connect = useCallback(async (nextPat: string, owner: string, repo: string, branch = 'main') => {
    const trimmedPat = nextPat.trim();
    const config: PersonalRepoConfig = { owner: owner.trim(), repo: repo.trim(), branch: branch.trim() || 'main' };

    if (!trimmedPat || !config.owner || !config.repo) {
      throw new Error('Preencha token, owner e repositório para conectar.');
    }

    setPat(trimmedPat);
    setRepoConfig(config);
    localStorage.setItem(PAT_STORAGE_KEY, trimmedPat);
    localStorage.setItem(REPO_STORAGE_KEY, JSON.stringify(config));

    personalLibraryApi.clearCache();

    try {
      const loadedFiles = await personalLibraryApi.getFiles(trimmedPat, config.owner, config.repo, config.branch);
      setFiles(loadedFiles);
      setError(null);
    } catch (err) {
      setPat(null);
      setRepoConfig(null);
      setFiles([]);
      localStorage.removeItem(PAT_STORAGE_KEY);
      localStorage.removeItem(REPO_STORAGE_KEY);
      throw err;
    }
  }, []);

  const disconnect = useCallback(() => {
    setPat(null);
    setRepoConfig(null);
    setFiles([]);
    setError(null);
    personalLibraryApi.clearCache();
    localStorage.removeItem(PAT_STORAGE_KEY);
    localStorage.removeItem(REPO_STORAGE_KEY);
  }, []);

  const openFile = useCallback(async (path: string): Promise<Article> => {
    if (!pat || !repoConfig) throw new Error('Biblioteca pessoal não conectada.');

    const content = await personalLibraryApi.getFileContent(pat, repoConfig.owner, repoConfig.repo, path, repoConfig.branch);

    if (content.type === 'text') {
      return articleApi.extractFromText(content.content, content.name);
    }

    const bytes = decodeBase64ToUint8Array(content.base64);
    const file = new File([bytes], content.name, { type: 'application/pdf' });
    return articleApi.extractFromPdf(file);
  }, [pat, repoConfig]);

  return {
    pat,
    repoConfig,
    files,
    isConnected,
    isLoadingFiles,
    error,
    connect,
    disconnect,
    loadFiles,
    openFile,
  };
}
