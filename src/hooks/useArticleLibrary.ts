import { useState, useCallback, useEffect } from 'react';
import { Article } from '@/types';
import { articleApi } from '@/services/article.api';

export function useArticleLibrary() {
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [fileHistory, setFileHistory] = useState<Article[]>([]);
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState(-1);

  useEffect(() => {
    const saved = localStorage.getItem('lector_library');
    if (saved) {
      try {
        setArticles(JSON.parse(saved));
      } catch {}
    }
  }, []);

  useEffect(() => {
    if (articles.length > 0) {
      localStorage.setItem('lector_library', JSON.stringify(
        articles.map(a => ({ ...a, content: a.content.slice(0, 500) }))
      ));
    }
  }, [articles]);

  const addArticle = useCallback(async (
    input: string | File,
    performAnalysis: (content: string, metadata: Partial<Article>) => Promise<string>
  ) => {
    setIsLoading(true);
    setError(null);
    try {
      let article: Article;
      if (typeof input === 'string' && input.startsWith('http')) {
        setCurrentUrl(input);
        article = await articleApi.extractFromUrl(input);
      } else if (typeof input === 'string') {
        article = await articleApi.extractFromText(input);
      } else {
        article = await articleApi.extractFromPdf(input);
      }

      await performAnalysis(article.content, { title: article.title, source: article.source, url: article.url });
      setArticles(prev => {
        const without = prev.filter(a => a.id !== article.id);
        return [article, ...without];
      });
      setSelectedArticle(article);
      setFileHistory(prev => [...prev, article]);
      setCurrentHistoryIndex(fileHistory.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar artigo');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [fileHistory.length]);

  const selectArticle = useCallback(async (id: string) => {
    const found = articles.find(a => a.id === id);
    if (!found) return;
    setSelectedArticle(found);
    const newHistory = fileHistory.slice(0, currentHistoryIndex + 1);
    newHistory.push(found);
    setFileHistory(newHistory);
    setCurrentHistoryIndex(newHistory.length - 1);
  }, [articles, fileHistory, currentHistoryIndex]);

  const navigateBack = useCallback(() => {
    if (currentHistoryIndex > 0) {
      const idx = currentHistoryIndex - 1;
      setCurrentHistoryIndex(idx);
      setSelectedArticle(fileHistory[idx]);
    }
  }, [currentHistoryIndex, fileHistory]);

  const navigateForward = useCallback(() => {
    if (currentHistoryIndex < fileHistory.length - 1) {
      const idx = currentHistoryIndex + 1;
      setCurrentHistoryIndex(idx);
      setSelectedArticle(fileHistory[idx]);
    }
  }, [currentHistoryIndex, fileHistory]);

  const clearLibrary = useCallback(() => {
    setCurrentUrl(null);
    setArticles([]);
    setSelectedArticle(null);
    setFileHistory([]);
    setCurrentHistoryIndex(-1);
    articleApi.clearCache();
    localStorage.removeItem('lector_library');
  }, []);

  return {
    currentUrl,
    articles,
    isLoading,
    error,
    selectedArticle,
    setSelectedArticle,
    fileHistory,
    currentHistoryIndex,
    addArticle,
    selectArticle,
    navigateBack,
    navigateForward,
    clearLibrary,
    setError
  };
}
