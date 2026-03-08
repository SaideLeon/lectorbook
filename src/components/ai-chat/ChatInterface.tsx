import { useState, useRef, useEffect, useCallback, Dispatch, SetStateAction } from 'react';
import { MessageSquare, Loader2, Maximize2, Minimize2, Youtube, ExternalLink, Check, Copy, ArrowUp, Mic, Square, Volume2, Pause, Radio } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import DOMPurify from 'dompurify';
import { cn } from '@/lib/utils';
import { AnalysisMessage } from '@/types';

const CodeBlock = ({ language, children, ...props }: any) => {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(String(children));
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="relative group rounded-md overflow-hidden my-4 border border-white/10">
      <div className="absolute right-2 top-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={handleCopy}
          className="p-1.5 bg-white/10 hover:bg-white/20 rounded-md text-gray-300 hover:text-white transition-colors"
          title="Copiar código"
        >
          {isCopied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
      <div className="bg-[#1e1e1e] px-4 py-2 text-xs text-gray-400 border-b border-white/5 flex justify-between items-center">
        <span>{language}</span>
      </div>
      <SyntaxHighlighter
        {...props}
        PreTag="div"
        children={String(children).replace(/\n$/, '')}
        language={language}
        style={atomDark}
        customStyle={{ margin: 0, borderRadius: 0, background: '#1a1a1a' }}
      />
    </div>
  );
};

// ─── Auto-resizing textarea hook ───────────────────────────────────────────
function useAutoResize(value: string, isExpanded: boolean) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || isExpanded) return;
    // Reset height so shrinkage works correctly
    el.style.height = 'auto';
    // Clamp between 44px (1 line) and 200px (≈5 lines)
    const next = Math.min(el.scrollHeight, 200);
    el.style.height = `${next}px`;
  }, [value, isExpanded]);

  return ref;
}

// ─── Chat input component ───────────────────────────────────────────────────
function ChatInput({
  input,
  setInput,
  onSend,
  disabled,
  onTranscribeAudio,
  isTranscribingAudio,
  onSendLiveVoiceMessage,
  isLiveModeActive,
}: {
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  onSend: () => void;
  disabled: boolean;
  onTranscribeAudio: (file: File) => Promise<string>;
  isTranscribingAudio: boolean;
  onSendLiveVoiceMessage: (message: string) => Promise<{ audioBase64: string; mimeType: string }>;
  isLiveModeActive: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingRecording, setIsProcessingRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const liveAudioRef = useRef<HTMLAudioElement | null>(null);
  const textareaRef = useAutoResize(input, isExpanded);

  // When collapsing, re-trigger auto-resize


  useEffect(() => {
    return () => {
      liveAudioRef.current?.pause();
    };
  }, []);

  const handleStopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
  }, []);

  const handleToggleRecording = useCallback(async () => {
    if (isRecording) {
      handleStopRecording();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType || 'audio/webm' });
        const ext = audioBlob.type.includes('mp4') ? 'm4a' : 'webm';
        const audioFile = new File([audioBlob], `recording.${ext}`, { type: audioBlob.type || 'audio/webm' });

        stream.getTracks().forEach((track) => track.stop());
        setIsRecording(false);
        setIsProcessingRecording(true);

        try {
          const text = await onTranscribeAudio(audioFile);
          if (text.trim()) {
            setInput((prev) => (prev ? `${prev} ${text}` : text));
          }
        } catch (error) {
          console.error('Falha ao transcrever áudio:', error);
        } finally {
          setIsProcessingRecording(false);
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Falha ao iniciar gravação de áudio:', error);
    }
  }, [handleStopRecording, isRecording, onTranscribeAudio, setInput]);



  const handleLiveVoiceTurn = useCallback(async () => {
    if (!input.trim() || disabled || isLiveModeActive) return;

    try {
      const { audioBase64, mimeType } = await onSendLiveVoiceMessage(input.trim());
      setInput('');

      const binary = atob(audioBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }

      const audioBlob = new Blob([bytes], { type: mimeType || 'audio/wav' });
      const audioUrl = URL.createObjectURL(audioBlob);

      liveAudioRef.current?.pause();
      const audio = new Audio(audioUrl);
      liveAudioRef.current = audio;

      audio.onended = () => URL.revokeObjectURL(audioUrl);
      audio.onerror = () => URL.revokeObjectURL(audioUrl);

      await audio.play();
    } catch (error) {
      console.error('Falha na conversa ao vivo:', error);
    }
  }, [disabled, input, isLiveModeActive, onSendLiveVoiceMessage, setInput]);

  const toggleExpand = () => {
    setIsExpanded((prev) => {
      if (prev) {
        // Collapsing: schedule resize after state update
        setTimeout(() => {
          const el = textareaRef.current;
          if (!el) return;
          el.style.height = 'auto';
          el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
        }, 0);
      }
      return !prev;
    });
  };

  return (
    <div
      className={cn(
        'transition-all duration-300 ease-in-out',
        isExpanded
          ? 'fixed inset-x-0 bottom-0 z-50 p-4 bg-[#0a0a0a]/95 backdrop-blur-md border-t border-white/10 shadow-2xl'
          : 'relative'
      )}
    >
      {/* Expanded header hint */}
      {isExpanded && (
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-xs text-gray-500">
            Pressione <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-gray-400 font-mono text-[10px]">Enter</kbd>
            {' '}para nova linha e clique no botão para enviar
          </span>
          <button
            type="button"
            onClick={toggleExpand}
            className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            title="Recolher"
          >
            <Minimize2 className="w-4 h-4" />
          </button>
        </div>
      )}

      <div
        className={cn(
          'flex items-end gap-2 bg-[#0a0a0a] border rounded-2xl px-3 py-2 transition-all duration-200',
          'focus-within:border-indigo-500/70 focus-within:ring-1 focus-within:ring-indigo-500/30',
          isExpanded ? 'border-indigo-500/50 rounded-xl' : 'border-white/10'
        )}
      >
        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Sugira uma melhoria ou faça uma pergunta..."
          disabled={disabled}
          rows={1}
          className={cn(
            'flex-1 bg-transparent border-none focus:ring-0 focus:outline-none resize-none',
            'text-sm text-white placeholder-gray-500 py-1.5 leading-6',
            'scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent',
            isExpanded ? 'max-h-[60vh] overflow-y-auto' : 'max-h-[200px] overflow-y-auto'
          )}
          style={isExpanded ? { height: '140px' } : undefined}
        />

        {/* Right-side action buttons */}
        <div className="flex items-center gap-1 shrink-0 pb-0.5">
          {/* Expand / collapse toggle */}
          {!isExpanded && (
            <button
              type="button"
              onClick={toggleExpand}
              className="p-1.5 rounded-lg hover:bg-white/10 text-gray-500 hover:text-gray-300 transition-colors"
              title="Expandir"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={handleToggleRecording}
            disabled={disabled || isTranscribingAudio || isProcessingRecording}
            className={cn(
              'p-1.5 rounded-lg transition-all duration-200',
              isRecording
                ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30'
                : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white',
              (disabled || isTranscribingAudio || isProcessingRecording) && 'opacity-60 cursor-not-allowed'
            )}
            title={isRecording ? 'Parar gravação' : 'Gravar áudio'}
          >
            {isTranscribingAudio || isProcessingRecording ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isRecording ? (
              <Square className="w-4 h-4" />
            ) : (
              <Mic className="w-4 h-4" />
            )}
          </button>

          <button
            type="button"
            onClick={handleLiveVoiceTurn}
            disabled={!input.trim() || disabled || isLiveModeActive}
            className={cn(
              'p-1.5 rounded-lg transition-all duration-200',
              input.trim() && !disabled && !isLiveModeActive
                ? 'bg-emerald-600/30 hover:bg-emerald-600/40 text-emerald-200'
                : 'bg-white/5 text-gray-600 cursor-not-allowed'
            )}
            title="Conversa ao vivo"
          >
            {isLiveModeActive ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radio className="w-4 h-4" />}
          </button>

          {/* Send button */}
          <button
            type="button"
            onClick={() => { if (input.trim() && !disabled) onSend(); }}
            disabled={!input.trim() || disabled}
            className={cn(
              'p-1.5 rounded-lg transition-all duration-200',
              input.trim() && !disabled
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                : 'bg-white/5 text-gray-600 cursor-not-allowed'
            )}
            title="Enviar"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Hint bar below (only in normal mode) */}
      {!isExpanded && (
        <p className="mt-1.5 text-[10px] text-gray-600 text-center select-none">
          <kbd className="font-mono">Enter</kbd> nova linha &nbsp;·&nbsp;
          clique no botão para enviar
        </p>
      )}
    </div>
  );
}

// ─── Main ChatInterface component ──────────────────────────────────────────
export const ChatInterface = ({
  messages,
  onSendMessage,
  isThinking,
  showThinkingState = isThinking,
  processLogs = [],
  isMaximized,
  onToggleMaximize,
  repositoryName,
  repositoryDescription,
  onTranscribeAudio,
  isTranscribingAudio = false,
  onSynthesizeAudio,
  isSynthesizingAudio = false,
  onSendLiveVoiceMessage,
  isLiveModeActive = false,
}: {
  messages: AnalysisMessage[];
  onSendMessage: (msg: string) => void;
  isThinking: boolean;
  showThinkingState?: boolean;
  processLogs?: string[];
  isMaximized: boolean;
  onToggleMaximize: () => void;
  repositoryName?: string;
  repositoryDescription?: string | null;
  onTranscribeAudio: (file: File) => Promise<string>;
  isTranscribingAudio?: boolean;
  onSynthesizeAudio: (text: string) => Promise<{ audioBase64: string; mimeType: string }>;
  isSynthesizingAudio?: boolean;
  onSendLiveVoiceMessage: (message: string) => Promise<{ audioBase64: string; mimeType: string }>;
  isLiveModeActive?: boolean;
}) => {
  const [input, setInput] = useState('');
  const [copiedMessageKey, setCopiedMessageKey] = useState<string | null>(null);
  const [speakingMessageKey, setSpeakingMessageKey] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCacheRef = useRef<Map<string, string>>(new Map());
  const welcomeRepositoryName = repositoryName || 'este repositório';
  const welcomeRepositoryDescription = repositoryDescription || 'Sem descrição disponível no repositório.';

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isThinking, processLogs]);

  const handleSend = useCallback(() => {
    if (input.trim()) {
      onSendMessage(input);
      setInput('');
    }
  }, [input, onSendMessage]);



  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      for (const url of audioCacheRef.current.values()) {
        URL.revokeObjectURL(url);
      }
      audioCacheRef.current.clear();
    };
  }, []);

  const handleSpeakMessage = useCallback(async (content: string, key: string) => {
    if (!content?.trim()) return;

    if (speakingMessageKey === key) {
      audioRef.current?.pause();
      setSpeakingMessageKey(null);
      return;
    }

    try {
      let audioUrl = audioCacheRef.current.get(key);

      if (!audioUrl) {
        const { audioBase64, mimeType } = await onSynthesizeAudio(content);
        const binary = atob(audioBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) {
          bytes[i] = binary.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: mimeType || 'audio/wav' });
        audioUrl = URL.createObjectURL(blob);
        audioCacheRef.current.set(key, audioUrl);
      }

      audioRef.current?.pause();
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      setSpeakingMessageKey(key);

      audio.onended = () => setSpeakingMessageKey((prev) => (prev === key ? null : prev));
      audio.onerror = () => setSpeakingMessageKey((prev) => (prev === key ? null : prev));

      await audio.play();
    } catch (error) {
      console.error('Falha ao sintetizar áudio da resposta:', error);
      setSpeakingMessageKey(null);
    }
  }, [onSynthesizeAudio, speakingMessageKey]);

  const handleCopyMessage = useCallback(async (content: string, key: string) => {
    if (!content?.trim()) return;

    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageKey(key);
      setTimeout(() => setCopiedMessageKey((prev) => (prev === key ? null : prev)), 2000);
    } catch (error) {
      console.error('Falha ao copiar mensagem:', error);
    }
  }, []);

  return (
    <div
      className={cn(
        'flex flex-col bg-[#111] rounded-xl border border-white/10 overflow-hidden transition-all duration-300',
        isMaximized ? 'h-full' : 'h-full'
      )}
    >
      {/* Header */}
      <div className="p-3 md:p-4 border-b border-white/10 bg-[#151515] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-medium flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-indigo-400" />
            Tutor de Leitura Lector
          </h3>
          {showThinkingState && (
            <span className="text-xs text-indigo-400 animate-pulse flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              Pensando profundamente...
            </span>
          )}
        </div>
        <button
          onClick={onToggleMaximize}
          className="p-1 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
          title={isMaximized ? 'Restaurar' : 'Maximizar'}
        >
          {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6" ref={scrollRef}>
        {messages.length === 0 && !isThinking && (
          <div className="h-full min-h-[280px] flex items-center justify-center">
            <div className="max-w-2xl text-left bg-[#151515] border border-white/10 rounded-xl p-6 space-y-4">
              <p className="text-xl text-white font-semibold">👋 Bem-vindo ao LectorBook</p>
              <p className="text-sm text-gray-300">Sou seu assistente de estudo.</p>
              <div className="text-sm text-gray-300">
                <p>Aqui você pode aprender sobre:</p>
                <p className="text-indigo-300 font-medium mt-1">{welcomeRepositoryName}</p>
                <p className="text-gray-400 mt-1">{welcomeRepositoryDescription}</p>
              </div>
              <div className="text-sm text-gray-300">
                <p>Posso:</p>
                <ul className="mt-1 space-y-1 text-gray-400">
                  <li>• explicar conteúdos</li>
                  <li>• resumir módulos</li>
                  <li>• responder dúvidas</li>
                  <li>• ajudar na revisão</li>
                </ul>
              </div>
              <p className="text-sm text-gray-300">Exemplo: "Explique este módulo como se eu fosse iniciante."</p>
              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => onSendMessage('Explique este módulo de forma simples.')}
                  className="px-3 py-2 text-xs rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 transition-colors"
                >
                  📖 Explicar módulo
                </button>
                <button
                  type="button"
                  onClick={() => onSendMessage('Resuma este conteúdo.')}
                  className="px-3 py-2 text-xs rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 transition-colors"
                >
                  🧠 Resumir conteúdo
                </button>
                <button
                  type="button"
                  onClick={() => onSendMessage('Quais são os conceitos principais?')}
                  className="px-3 py-2 text-xs rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 transition-colors"
                >
                  ❓ Tirar dúvidas
                </button>
              </div>
              <p className="text-xs text-gray-500">Faça sua pergunta para começar.</p>
            </div>
          </div>
        )}

        {messages.map((msg, idx) => {
          const messageKey = `${msg.timestamp || idx}-${msg.role}-${idx}`;
          return (
          <div key={messageKey} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div
              className={cn(
                'max-w-[99%] rounded-2xl p-4 text-sm leading-relaxed overflow-hidden',
                msg.role === 'user'
                  ? 'bg-gray-800 text-white'
                  : 'bg-[#1a1a1a] border border-white/10 text-gray-200'
              )}
            >
              {msg.role === 'model' && (
                <div className="mb-3 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => handleSpeakMessage(msg.content, messageKey)}
                    disabled={isSynthesizingAudio && speakingMessageKey !== messageKey}
                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-white/10 bg-white/5 hover:bg-white/10 text-xs text-gray-300 hover:text-white transition-colors disabled:opacity-60"
                    title={speakingMessageKey === messageKey ? 'Parar áudio' : 'Ouvir resposta'}
                    aria-label={speakingMessageKey === messageKey ? 'Parar áudio da resposta da IA' : 'Ouvir resposta da IA'}
                  >
                    {(isSynthesizingAudio && speakingMessageKey !== messageKey) ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : speakingMessageKey === messageKey ? (
                      <Pause className="w-3.5 h-3.5" />
                    ) : (
                      <Volume2 className="w-3.5 h-3.5" />
                    )}
                    Áudio
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCopyMessage(msg.content, messageKey)}
                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-white/10 bg-white/5 hover:bg-white/10 text-xs text-gray-300 hover:text-white transition-colors"
                    title="Copiar resposta"
                    aria-label="Copiar resposta da IA"
                  >
                    {copiedMessageKey === messageKey ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-green-400" />
                        Copiado
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Copiar
                      </>
                    )}
                  </button>
                </div>
              )}

              <div className="prose prose-invert prose-sm max-w-none break-words">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code(props) {
                      const { children, className, node, ref, ...rest } = props;
                      const match = /language-(\w+)/.exec(className || '');
                      return match ? (
                        <CodeBlock language={match[1]} children={children} {...rest} />
                      ) : (
                        <code {...rest} ref={ref} className={className}>
                          {children}
                        </code>
                      );
                    },
                  }}
                >
                  {DOMPurify.sanitize(msg.content)}
                </ReactMarkdown>
              </div>

              {msg.relatedLinks && msg.relatedLinks.length > 0 && (
                <div className="mt-4 pt-4 border-t border-white/10">
                  <h4 className="text-xs font-semibold text-gray-500 mb-2 uppercase">Referências e Recursos</h4>
                  <div className="grid gap-2">
                    {msg.relatedLinks.map((link, i) => (
                      <a
                        key={i}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-xs text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 p-2 rounded hover:bg-indigo-500/20 transition-colors"
                      >
                        {link.url.includes('youtube') ? (
                          <Youtube className="w-3 h-3 text-red-500" />
                        ) : (
                          <ExternalLink className="w-3 h-3" />
                        )}
                        <span className="truncate">{link.title || link.url}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
        })}

        {showThinkingState && (
          <div className="flex justify-start">
            <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-4 text-sm text-gray-300 w-full max-w-[99%]">
              <div className="italic text-gray-400 animate-pulse mb-2">Processando solicitação do docente...</div>
              <ul className="space-y-1 text-xs font-mono">
                {(processLogs.length > 0 ? processLogs : ['Aguardando logs de processamento...']).map(
                  (log, idx) => (
                    <li key={idx} className="text-gray-400">
                      • {log}
                    </li>

                  )
                )}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="p-3 md:p-4 bg-[#151515] border-t border-white/10">
        <ChatInput
          input={input}
          setInput={setInput}
          onSend={handleSend}
          disabled={isThinking}
          onTranscribeAudio={onTranscribeAudio}
          isTranscribingAudio={isTranscribingAudio}
          onSendLiveVoiceMessage={onSendLiveVoiceMessage}
          isLiveModeActive={isLiveModeActive}
        />
      </div>
    </div>
  );
};
