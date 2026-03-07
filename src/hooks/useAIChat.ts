import { useState, useCallback } from 'react';
import { AnalysisMessage } from '@/types';
import { analyzeCode, thinkAndSuggest, generateReadingSheet as generateReadingSheetService } from '@/services/ai';
import { limitTextContext } from '@/utils/textLimiter';
import { getResponseText } from '@/utils/ai-helpers';

export function useAIChat() {
  const [chatHistory, setChatHistory] = useState<AnalysisMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isGeneratingReadingSheet, setIsGeneratingReadingSheet] = useState(false);
  const [processLogs, setProcessLogs] = useState<string[]>([]);
  
  const [apiKeys, setApiKeys] = useState<string[]>([]);
  const [keyIndex, setKeyIndex] = useState(0);

  const appendLog = useCallback((log: string) => {
    setProcessLogs((prev) => [...prev, `[${new Date().toLocaleTimeString('pt-BR')}] ${log}`]);
  }, []);

  const getNextKey = useCallback(() => {
    if (apiKeys.length > 0) {
      const key = apiKeys[keyIndex];
      setKeyIndex((prev) => (prev + 1) % apiKeys.length);
      return key;
    }
    return undefined;
  }, [apiKeys, keyIndex]);

  const handleKeyFileUpload = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      const keys = text.split(/\r?\n/).map(k => k.trim()).filter(k => k.length > 20);
      
      if (keys.length === 0) {
        throw new Error('Nenhuma chave válida encontrada no arquivo.');
      }
      
      setApiKeys(keys);
      setKeyIndex(0);
      return keys.length;
    } catch (err) {
      console.error('Erro ao ler arquivo de chaves:', err);
      throw err;
    }
  }, []);

  const performInitialAnalysis = useCallback(async (files: { path: string, content: string }[]) => {
    try {
      const activeKey = getNextKey();
      
      const limitedFiles = files.map(f => ({
        path: f.path,
        content: limitTextContext(f.content)
      }));

      const aiRes = await analyzeCode(limitedFiles, undefined, activeKey);
      const analysisText = getResponseText(aiRes);
      
      if (!analysisText) {
        throw new Error('A resposta da IA veio vazia. Verifique os logs do servidor.');
      }
      
      setAnalysis(analysisText);
      setChatHistory([{
        role: 'model',
        content: analysisText,
        timestamp: Date.now(),
        relatedLinks: aiRes.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((c: any) => ({
             title: c.web?.title || 'Fonte',
             url: c.web?.uri
        })).filter((l: any): l is { title: string; url: string } => !!l.url) || []
      }]);
      
      return analysisText;
    } catch (error) {
      console.error('AI Analysis Error:', error);
      throw error;
    }
  }, [getNextKey]);

  const sendMessage = useCallback(async (msg: string, contextFiles: { path: string; content: string }[] = []) => {
    const newHistory = [...chatHistory, { role: 'user', content: msg, timestamp: Date.now() } as AnalysisMessage];
    setChatHistory(newHistory);
    setIsThinking(true);
    setProcessLogs([]);

    try {
      appendLog('Iniciando solicitação ao Tutor de Leitura Lector...');
      const activeKey = getNextKey();

      const limitedContextFiles = contextFiles.map((f) => ({
        path: f.path,
        content: limitTextContext(f.content)
      }));

      if (limitedContextFiles.length > 0) {
        appendLog(`Contexto automático carregado: ${limitedContextFiles.length} arquivo(s) .md/.txt do GitHub.`);
      } else {
        appendLog('Nenhum arquivo .md/.txt disponível no repositório para contexto automático.');
      }

      appendLog('Enviando contexto e pergunta para o modelo de IA...');
      const response = await thinkAndSuggest(
        newHistory.map(h => ({ role: h.role, content: h.content })),
        msg,
        analysis || 'Nenhum contexto disponível.',
        limitedContextFiles,
        activeKey
      );

      appendLog('Resposta recebida. Processando conteúdo e referências...');
      const responseText = getResponseText(response);
      
      if (!responseText) {
         throw new Error('A resposta da IA veio vazia.');
      }
      
      const links = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((c: any) => ({
        title: c.web?.title || 'Fonte',
        url: c.web?.uri
      })).filter((l: any): l is { title: string; url: string } => !!l.url) || [];

      setChatHistory(prev => [...prev, {
        role: 'model',
        content: responseText,
        timestamp: Date.now(),
        relatedLinks: links
      }]);

      appendLog('Concluído com sucesso.');
    } catch (err) {
      console.error(err);
      appendLog(`Falha no processamento: ${err instanceof Error ? err.message : 'erro desconhecido'}`);
      setChatHistory(prev => [...prev, {
        role: 'model',
        content: `Erro: ${err instanceof Error ? err.message : 'Erro desconhecido ao processar resposta.'}`,
        timestamp: Date.now()
      }]);
    } finally {
      setIsThinking(false);
    }
  }, [chatHistory, analysis, getNextKey, appendLog]);

  const generateReadingSheet = useCallback(async (repoName: string, contextFiles: { path: string, content: string }[]) => {
    if (!analysis) return;
    setIsGeneratingReadingSheet(true);
    
    try {
      const activeKey = getNextKey();
      const limitedFiles = contextFiles.map(f => ({
        path: f.path,
        content: limitTextContext(f.content)
      }));

      const response = await generateReadingSheetService(limitedFiles, analysis, activeKey);
      const readingSheetText = getResponseText(response);
      
      if (!readingSheetText) {
        throw new Error('A resposta da IA veio vazia.');
      }
      
      const blob = new Blob([readingSheetText], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ficha-de-leitura-${repoName}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Reading sheet generation failed:', err);
      throw err;
    } finally {
      setIsGeneratingReadingSheet(false);
    }
  }, [analysis, getNextKey]);

  return {
    chatHistory,
    isThinking,
    analysis,
    isGeneratingReadingSheet,
    processLogs,
    performInitialAnalysis,
    sendMessage,
    generateReadingSheet,
    setChatHistory,
    apiKeys,
    keyIndex,
    handleKeyFileUpload
  };
}
