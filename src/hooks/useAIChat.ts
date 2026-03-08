import { useState, useCallback, useEffect, useRef } from 'react';
import { AnalysisMessage } from '@/types';
import { analyzeCode, thinkAndSuggestStream, generateReadingSheet as generateReadingSheetService, transcribeAudio, synthesizeTextToSpeech } from '@/services/ai';
import { limitTextContext } from '@/utils/textLimiter';
import { getResponseText } from '@/utils/ai-helpers';
import { generateStyledPdfFromMarkdown } from '@/utils/pdf-generator';
import { loadGeminiApiKeys, saveGeminiApiKeys } from '@/utils/indexeddb';

const ERROR_DISPLAY_MS = 8000;

export function useAIChat() {
  const [chatHistory, setChatHistory] = useState<AnalysisMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [isWaitingForFirstChunk, setIsWaitingForFirstChunk] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isGeneratingReadingSheet, setIsGeneratingReadingSheet] = useState(false);
  const [isTranscribingAudio, setIsTranscribingAudio] = useState(false);
  const [isSynthesizingAudio, setIsSynthesizingAudio] = useState(false);
  const [processLogs, setProcessLogs] = useState<string[]>([]);
  const chatErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const [apiKeys, setApiKeys] = useState<string[]>([]);
  const [keyIndex, setKeyIndex] = useState(0);
  const [keysHydrated, setKeysHydrated] = useState(false);

  const appendLog = useCallback((log: string) => {
    setProcessLogs((prev) => [...prev, `[${new Date().toLocaleTimeString('pt-BR')}] ${log}`]);
  }, []);

  useEffect(() => () => {
    if (chatErrorTimerRef.current) clearTimeout(chatErrorTimerRef.current);
  }, []);


  useEffect(() => {
    let mounted = true;

    const restoreKeys = async () => {
      try {
        const storedKeys = await loadGeminiApiKeys();
        if (!mounted) return;

        if (storedKeys.length > 0) {
          setApiKeys(storedKeys);
          setKeyIndex(0);
        }
      } catch (error) {
        console.error('Falha ao restaurar chaves Gemini do IndexedDB:', error);
      } finally {
        if (mounted) setKeysHydrated(true);
      }
    };

    restoreKeys();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!keysHydrated) return;

    saveGeminiApiKeys(apiKeys).catch((error) => {
      console.error('Falha ao persistir chaves Gemini no IndexedDB:', error);
    });
  }, [apiKeys, keysHydrated]);

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
    setIsWaitingForFirstChunk(true);
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

      const answerTimestamp = Date.now();
      setChatHistory(prev => [...prev, {
        role: 'model',
        content: '',
        timestamp: answerTimestamp,
        relatedLinks: []
      }]);

      let streamedText = '';

      await thinkAndSuggestStream(
        newHistory.map(h => ({ role: h.role, content: h.content })),
        msg,
        analysis || 'Nenhum contexto disponível.',
        limitedContextFiles,
        {
          onChunk: (chunkText: string) => {
            setIsWaitingForFirstChunk(false);
            streamedText += chunkText;
            setChatHistory(prev => {
              const next = [...prev];
              const targetIndex = next.findIndex(m => m.timestamp === answerTimestamp && m.role === 'model');
              if (targetIndex === -1) return prev;

              next[targetIndex] = {
                ...next[targetIndex],
                content: streamedText,
              };
              return next;
            });
          },
          onDone: (relatedLinks) => {
            setIsWaitingForFirstChunk(false);
            setChatHistory(prev => {
              const next = [...prev];
              const targetIndex = next.findIndex(m => m.timestamp === answerTimestamp && m.role === 'model');
              if (targetIndex === -1) return prev;

              next[targetIndex] = {
                ...next[targetIndex],
                relatedLinks,
              };
              return next;
            });
          }
        },
        activeKey
      );

      if (!streamedText.trim()) {
        throw new Error('A resposta da IA veio vazia.');
      }

      appendLog('Concluído com sucesso.');
    } catch (err) {
      setIsWaitingForFirstChunk(false);
      console.error(err);
      appendLog(`Falha no processamento: ${err instanceof Error ? err.message : 'erro desconhecido'}`);
      setChatHistory(prev => {
        const next = [...prev];
        const lastModelIndex = [...next].reverse().findIndex((m) => m.role === 'model');

        if (lastModelIndex !== -1) {
          const targetIndex = next.length - 1 - lastModelIndex;
          next[targetIndex] = {
            ...next[targetIndex],
            content: `Erro: ${err instanceof Error ? err.message : 'Erro desconhecido ao processar resposta.'}`,
          };
          return next;
        }

        return [...next, {
          role: 'model',
          content: `Erro: ${err instanceof Error ? err.message : 'Erro desconhecido ao processar resposta.'}`,
          timestamp: Date.now()
        }];
      });

      if (chatErrorTimerRef.current) clearTimeout(chatErrorTimerRef.current);
      chatErrorTimerRef.current = setTimeout(() => {
        setChatHistory((prev) =>
          prev.filter((m) => !(m.role === 'model' && m.content.startsWith('Erro:')))
        );
      }, ERROR_DISPLAY_MS);
    } finally {
      setIsThinking(false);
      setIsWaitingForFirstChunk(false);
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
      
      const safeRepoName = repoName.replace(/[^a-zA-Z0-9-_]+/g, '-');
      const blob = generateStyledPdfFromMarkdown(readingSheetText, `Ficha de Leitura — ${repoName}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ficha-de-leitura-${safeRepoName}.pdf`;
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

  const transcribeAudioMessage = useCallback(async (file: File) => {
    setIsTranscribingAudio(true);
    try {
      return await transcribeAudio(file);
    } finally {
      setIsTranscribingAudio(false);
    }
  }, []);


  const synthesizeMessageAudio = useCallback(async (text: string) => {
    setIsSynthesizingAudio(true);
    try {
      const activeKey = getNextKey();
      return await synthesizeTextToSpeech(text, activeKey);
    } finally {
      setIsSynthesizingAudio(false);
    }
  }, [getNextKey]);




  return {
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
    setChatHistory,
    apiKeys,
    keyIndex,
    handleKeyFileUpload
  };
}
