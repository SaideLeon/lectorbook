import { useState, useCallback } from 'react';
import { AnalysisMessage, Article } from '@/types';
import { analyzeArticle, thinkAndSuggest, generateArticleReport as generateReportService } from '@/services/ai';
import { limitTextContext } from '@/utils/textLimiter';
import { getResponseText } from '@/utils/ai-helpers';

export function useAIChat() {
  const [chatHistory, setChatHistory] = useState<AnalysisMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [apiKeys, setApiKeys] = useState<string[]>([]);
  const [keyIndex, setKeyIndex] = useState(0);

  const getNextKey = useCallback(() => {
    if (apiKeys.length > 0) {
      const key = apiKeys[keyIndex];
      setKeyIndex((prev) => (prev + 1) % apiKeys.length);
      return key;
    }
    return undefined;
  }, [apiKeys, keyIndex]);

  const handleKeyFileUpload = useCallback(async (file: File) => {
    const text = await file.text();
    const keys = text.split(/\r?\n/).map(k => k.trim()).filter(k => k.length > 20);
    if (keys.length === 0) throw new Error('Nenhuma chave válida encontrada no arquivo.');
    setApiKeys(keys);
    setKeyIndex(0);
    return keys.length;
  }, []);

  const performInitialAnalysis = useCallback(async (content: string, metadata: Partial<Article>) => {
    const activeKey = getNextKey();
    const aiRes = await analyzeArticle(limitTextContext(content), metadata, activeKey);
    const analysisText = getResponseText(aiRes);
    if (!analysisText) throw new Error('A resposta da IA veio vazia.');

    setAnalysis(analysisText);
    setChatHistory([{
      role: 'model',
      content: analysisText,
      timestamp: Date.now(),
      relatedLinks: aiRes.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((c: any) => ({
        title: c.web?.title || 'Fonte',
        url: c.web?.uri
      })).filter((l: any) => !!l.url) || []
    }]);
    return analysisText;
  }, [getNextKey]);

  const sendMessage = useCallback(async (msg: string) => {
    const newHistory = [...chatHistory, { role: 'user', content: msg, timestamp: Date.now() } as AnalysisMessage];
    setChatHistory(newHistory);
    setIsThinking(true);
    try {
      const response = await thinkAndSuggest(newHistory.map(h => ({ role: h.role, content: h.content })), msg, analysis || 'Sem contexto.', getNextKey());
      const responseText = getResponseText(response);
      if (!responseText) throw new Error('A resposta da IA veio vazia.');
      const links = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((c: any) => ({ title: c.web?.title || 'Fonte', url: c.web?.uri })).filter((l: any) => !!l.url) || [];
      setChatHistory(prev => [...prev, { role: 'model', content: responseText, timestamp: Date.now(), relatedLinks: links }]);
    } catch (err) {
      setChatHistory(prev => [...prev, { role: 'model', content: `Erro: ${err instanceof Error ? err.message : 'Erro desconhecido.'}`, timestamp: Date.now() }]);
    } finally {
      setIsThinking(false);
    }
  }, [analysis, chatHistory, getNextKey]);

  const generateArticleReport = useCallback(async (article: Article) => {
    if (!analysis) return;
    setIsGeneratingReport(true);
    try {
      const response = await generateReportService({ title: article.title, content: limitTextContext(article.content) }, analysis, getNextKey());
      const report = getResponseText(response);
      if (!report) throw new Error('A resposta da IA veio vazia.');
      const blob = new Blob([report], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `relatorio-${article.title.replace(/\s+/g, '-').toLowerCase()}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setIsGeneratingReport(false);
    }
  }, [analysis, getNextKey]);

  return { chatHistory, isThinking, analysis, isGeneratingReport, performInitialAnalysis, sendMessage, generateArticleReport, setChatHistory, apiKeys, keyIndex, handleKeyFileUpload };
}
