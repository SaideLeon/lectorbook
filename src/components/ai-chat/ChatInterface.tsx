import { useState, useRef, useEffect, useMemo } from 'react';
import { MessageSquare, Loader2, Maximize2, Minimize2, Code2, ChevronRight, Youtube, ExternalLink, Check, Copy } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
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

export const ChatInterface = ({ 
  messages, 
  onSendMessage, 
  isThinking,
  processLogs = [],
  isMaximized,
  onToggleMaximize
}: { 
  messages: AnalysisMessage[], 
  onSendMessage: (msg: string) => void,
  isThinking: boolean,
  processLogs?: string[],
  isMaximized: boolean,
  onToggleMaximize: () => void
}) => {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isThinking, processLogs]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      onSendMessage(input);
      setInput('');
    }
  };

  return (
    <div className={cn(
      "flex flex-col bg-[#111] rounded-xl border border-white/10 overflow-hidden transition-all duration-300", 
      isMaximized ? "h-full" : "h-full lg:h-[600px]"
    )}>
      <div className="p-3 md:p-4 border-b border-white/10 bg-[#151515] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-medium flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-indigo-400" />
            Docente Lector
          </h3>
          {isThinking && (
            <span className="text-xs text-indigo-400 animate-pulse flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              Pensando profundamente...
            </span>
          )}
        </div>
        <button 
          onClick={onToggleMaximize}
          className="p-1 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
          title={isMaximized ? "Restaurar" : "Maximizar"}
        >
          {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-6" ref={scrollRef}>
        {messages.map((msg, idx) => (
          <div key={idx} className={cn("flex gap-4", msg.role === 'user' ? "flex-row-reverse" : "")}>
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
              msg.role === 'user' ? "bg-gray-700" : "bg-indigo-600"
            )}>
              {msg.role === 'user' ? <span className="text-xs">Você</span> : <Code2 className="w-4 h-4" />}
            </div>
            <div className={cn(
              "max-w-[80%] rounded-2xl p-4 text-sm leading-relaxed overflow-hidden",
              msg.role === 'user' ? "bg-gray-800 text-white" : "bg-[#1a1a1a] border border-white/10 text-gray-200"
            )}>
              <div className="prose prose-invert prose-sm max-w-none break-words">
                <ReactMarkdown
                  components={{
                    code(props) {
                      const {children, className, node, ref, ...rest} = props
                      const match = /language-(\w+)/.exec(className || '')
                      return match ? (
                        <CodeBlock language={match[1]} children={children} {...rest} />
                      ) : (
                        <code {...rest} ref={ref} className={className}>
                          {children}
                        </code>
                      )
                    }
                  }}
                >
                  {/* Sanitize content before rendering */}
                  {DOMPurify.sanitize(msg.content)}
                </ReactMarkdown>
              </div>
              
              {/* Grounding / Links */}
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
                        {link.url.includes('youtube') ? <Youtube className="w-3 h-3 text-red-500" /> : <ExternalLink className="w-3 h-3" />}
                        <span className="truncate">{link.title || link.url}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        {isThinking && (
           <div className="flex gap-4">
             <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center shrink-0">
               <Code2 className="w-4 h-4" />
             </div>
             <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-4 text-sm text-gray-300 w-full">
               <div className="italic text-gray-400 animate-pulse mb-2">Processando solicitação do docente...</div>
               <ul className="space-y-1 text-xs font-mono">
                 {(processLogs.length > 0 ? processLogs : ['Aguardando logs de processamento...']).map((log, idx) => (
                   <li key={idx} className="text-gray-400">• {log}</li>
                 ))}
               </ul>
             </div>
           </div>
        )}
      </div>

      <form onSubmit={handleSend} className="p-4 bg-[#151515] border-t border-white/10">
        <div className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Sugira uma melhoria ou faça uma pergunta..."
            className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-4 py-3 pr-12 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
            disabled={isThinking}
          />
          <button 
            type="submit" 
            disabled={!input.trim() || isThinking}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
};
