/**
 * src/server/groq.service.ts
 *
 * Serviço Groq: fallback para quando a Gemini retorna erros (500, 503, etc.)
 *
 * Suporte a múltiplas chaves via env:
 *   GROQ_API_KEY=chave1,chave2,chave3   ← separadas por vírgula
 *   ou GROQ_API_KEY_1, GROQ_API_KEY_2, GROQ_API_KEY_3  ← variáveis numeradas
 *
 * Estratégia de rotação:
 *   - Round-robin entre chaves disponíveis.
 *   - Quando uma chave recebe 429, é colocada em cooldown pelo tempo sugerido
 *     pelo Groq (ou 15s padrão) e a próxima chave disponível é usada imediatamente.
 *   - Se todas as chaves estiverem em cooldown, aguarda a que sair primeiro.
 */

type GroqMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: GroqToolCall[];
  tool_call_id?: string;
};

type GroqToolCall = {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
};

type GroqTool = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, { type: string; description: string }>;
      required: string[];
    };
  };
};

// ─── Gerenciador de múltiplas chaves ────────────────────────────────────────

interface KeyEntry {
  key: string;
  cooldownUntil: number; // timestamp ms — 0 = disponível
}

class GroqKeyManager {
  private keys: KeyEntry[] = [];
  private currentIndex = 0;

  constructor() {
    this.loadKeys();
  }

  private loadKeys() {
    const entries: string[] = [];

    // Opção 1: GROQ_API_KEY com múltiplas chaves separadas por vírgula
    const single = process.env.GROQ_API_KEY ?? '';
    entries.push(...single.split(',').map((k) => k.trim()).filter(Boolean));

    // Opção 2: GROQ_API_KEY_1, GROQ_API_KEY_2, ...
    for (let i = 1; i <= 20; i++) {
      const k = process.env[`GROQ_API_KEY_${i}`]?.trim();
      if (k) entries.push(k);
    }

    // Deduplica mantendo ordem
    const seen = new Set<string>();
    for (const k of entries) {
      if (!seen.has(k)) {
        seen.add(k);
        this.keys.push({ key: k, cooldownUntil: 0 });
      }
    }

    if (this.keys.length === 0) {
      throw new Error('Nenhuma GROQ_API_KEY configurada no ambiente.');
    }

    if (this.keys.length > 1) {
      console.log(`[GroqKeyManager] ${this.keys.length} chaves Groq carregadas.`);
    }
  }

  /**
   * Retorna a próxima chave disponível (não em cooldown).
   * Se todas estiverem em cooldown, aguarda a que sair primeiro.
   */
  async acquire(): Promise<{ key: string; index: number }> {
    const now = Date.now();

    // Procura disponível a partir do índice atual (round-robin)
    for (let offset = 0; offset < this.keys.length; offset++) {
      const idx = (this.currentIndex + offset) % this.keys.length;
      if (this.keys[idx].cooldownUntil <= now) {
        this.currentIndex = (idx + 1) % this.keys.length;
        return { key: this.keys[idx].key, index: idx };
      }
    }

    // Todas em cooldown — aguarda a que sair primeiro
    const soonest = this.keys.reduce((a, b) => (a.cooldownUntil < b.cooldownUntil ? a : b));
    const wait = soonest.cooldownUntil - Date.now() + 50;
    console.warn(`[GroqKeyManager] Todas as ${this.keys.length} chave(s) em cooldown. Aguardando ${(wait / 1000).toFixed(1)}s...`);
    await new Promise<void>((r) => setTimeout(r, wait));
    return this.acquire();
  }

  /** Coloca uma chave em cooldown após receber 429. */
  setCooldown(index: number, cooldownMs: number) {
    this.keys[index].cooldownUntil = Date.now() + cooldownMs;
    console.warn(
      `[GroqKeyManager] Chave #${index + 1}/${this.keys.length} em cooldown por ${(cooldownMs / 1000).toFixed(1)}s.`,
    );
  }

  get count() { return this.keys.length; }
}

// Singleton — inicializado na primeira chamada
let _keyManager: GroqKeyManager | null = null;
function getKeyManager(): GroqKeyManager {
  if (!_keyManager) _keyManager = new GroqKeyManager();
  return _keyManager;
}

// ─── Modelos ─────────────────────────────────────────────────────────────────

export const GROQ_PRIMARY_MODEL  = 'llama-3.3-70b-versatile';
export const GROQ_FALLBACK_MODEL = 'llama3-groq-70b-8192-tool-use-preview';

// ─── Utilitários ─────────────────────────────────────────────────────────────

function parseRetryAfterMs(errorBody: string): number {
  const match = errorBody.match(/try again in\s+([\d.]+)s/i);
  if (match) return Math.ceil(parseFloat(match[1]) * 1000) + 300;
  return 15_000; // padrão conservador
}

/**
 * Faz um fetch ao Groq com rotação automática de chaves em caso de 429.
 *
 * `buildBody(apiKey)` recebe a chave atual e retorna o body a enviar —
 * isso permite que o caller altere o modelo ou payload por tentativa.
 */
async function groqFetch(
  url: string,
  buildBody: (apiKey: string, attempt: number) => Record<string, unknown>,
  maxAttempts = 6,
): Promise<Response> {
  const manager = getKeyManager();

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const { key, index } = await manager.acquire();
    const body = buildBody(key, attempt);

    // A partir da 2ª tentativa, troca para o modelo fallback (limite separado)
    if (attempt > 0 && body.model === GROQ_PRIMARY_MODEL) {
      body.model = GROQ_FALLBACK_MODEL;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
    });

    if (response.ok) return response;

    const text = await response.text();

    if (response.status === 429) {
      const cooldownMs = parseRetryAfterMs(text);
      manager.setCooldown(index, cooldownMs);

      if (attempt < maxAttempts - 1) {
        console.warn(
          `[Groq] 429 chave #${index + 1}. Tentativa ${attempt + 1}/${maxAttempts} — rotacionando...`,
        );
        continue;
      }

      throw new Error(`Groq: todas as chaves atingiram rate limit. Última resposta: ${text}`);
    }

    throw new Error(`Groq API error (${response.status}): ${text}`);
  }

  throw new Error('Groq: número máximo de tentativas atingido.');
}

// ─── Definição das Tools ─────────────────────────────────────────────────────

export const LECTOR_TOOLS: GroqTool[] = [
  {
    type: 'function',
    function: {
      name: 'find_in_documents',
      description:
        'Busca trechos relevantes nos arquivos .md e .txt do repositório GitHub ' +
        'já carregados no contexto. Use quando precisar localizar informação ' +
        'específica em um ou mais documentos antes de responder.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Palavra-chave ou frase para buscar nos documentos.' },
          file_path: {
            type: 'string',
            description: 'Caminho parcial do arquivo para restringir a busca (opcional).',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_documents',
      description:
        'Lista todos os arquivos de documentação (.md/.txt) disponíveis no repositório.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_document',
      description: 'Retorna o conteúdo completo de um arquivo específico do repositório.',
      parameters: {
        type: 'object',
        properties: {
          file_path: { type: 'string', description: 'Caminho exato do arquivo. Ex: "modulos/modulo-1.md".' },
        },
        required: ['file_path'],
      },
    },
  },
];

// ─── Executor de Tools ────────────────────────────────────────────────────────

export function executeGroqTool(
  toolName: string,
  rawArgs: string,
  contextFiles: { path: string; content: string }[],
): string {
  let args: Record<string, string> = {};
  try { args = JSON.parse(rawArgs || '{}'); } catch { return 'Erro: argumentos inválidos.'; }

  if (toolName === 'find_in_documents') {
    const { query, file_path } = args;
    if (!query) return 'Erro: parâmetro "query" é obrigatório.';
    const lowerQuery = query.toLowerCase();
    const filesToSearch = file_path
      ? contextFiles.filter((f) => f.path.toLowerCase().includes(file_path.toLowerCase()))
      : contextFiles;
    if (!filesToSearch.length) return `Nenhum arquivo encontrado${file_path ? ` com caminho "${file_path}"` : ''}.`;
    const results: string[] = [];
    for (const file of filesToSearch) {
      const lines = file.content.split('\n');
      const matches = lines
        .map((line, idx) => ({ line, idx }))
        .filter(({ line }) => line.toLowerCase().includes(lowerQuery));
      if (matches.length)
        results.push(
          `=== ${file.path} (${matches.length} ocorrência(s)) ===\n` +
          matches.slice(0, 8).map(({ line, idx }) => `L${idx + 1}: ${line.trim()}`).join('\n'),
        );
    }
    return results.length ? results.join('\n\n') : `Nenhuma ocorrência de "${query}" encontrada.`;
  }

  if (toolName === 'list_documents') {
    if (!contextFiles.length) return 'Nenhum arquivo .md/.txt disponível.';
    return (
      `Arquivos disponíveis (${contextFiles.length}):\n` +
      contextFiles.map((f) => `- ${f.path}  (${f.content.split('\n').length} linhas)`).join('\n')
    );
  }

  if (toolName === 'get_document') {
    const { file_path } = args;
    if (!file_path) return 'Erro: parâmetro "file_path" é obrigatório.';
    const file = contextFiles.find((f) => f.path === file_path || f.path.endsWith(file_path));
    if (!file) return `Arquivo "${file_path}" não encontrado. Use list_documents para ver os disponíveis.`;
    const lines = file.content.split('\n');
    return (
      `=== ${file.path} ===\n` +
      lines.slice(0, 200).join('\n') +
      (lines.length > 200 ? `\n\n[... ${lines.length - 200} linhas omitidas ...]` : '')
    );
  }

  return `Tool "${toolName}" não reconhecida.`;
}

// ─── Chat com Loop Agêntico + Streaming ──────────────────────────────────────

const MAX_TOOL_ITERATIONS = 4;

export async function groqChatStream(options: {
  messages: GroqMessage[];
  systemInstruction: string;
  contextFiles: { path: string; content: string }[];
  onChunk: (text: string) => void;
  onDone: () => void;
  onError: (err: Error) => void;
}): Promise<void> {
  const { messages, systemInstruction, contextFiles, onChunk, onDone, onError } = options;

  const fullMessages: GroqMessage[] = [
    { role: 'system', content: systemInstruction },
    ...messages,
  ];

  try {
    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      // ── Chamada não-streaming para checar tool calls ──────────────────────
      const response = await groqFetch(
        'https://api.groq.com/openai/v1/chat/completions',
        (_key, _attempt) => ({
          model: GROQ_PRIMARY_MODEL,
          messages: fullMessages,
          tools: LECTOR_TOOLS,
          tool_choice: 'auto',
          temperature: 0.7,
          max_tokens: 8192,
        }),
      );

      const data = await response.json();
      const assistantMessage = data.choices[0].message;

      fullMessages.push({
        role: 'assistant',
        content: assistantMessage.content ?? null,
        tool_calls: assistantMessage.tool_calls,
      });

      const toolCalls = assistantMessage.tool_calls;

      if (!toolCalls || toolCalls.length === 0) {
        // ── Resposta final — com streaming ──────────────────────────────────
        const messagesForStream = fullMessages.slice(0, -1);

        const streamResponse = await groqFetch(
          'https://api.groq.com/openai/v1/chat/completions',
          () => ({
            model: GROQ_PRIMARY_MODEL,
            messages: messagesForStream,
            temperature: 0.7,
            max_tokens: 8192,
            stream: true,
          }),
        );

        if (!streamResponse.body) throw new Error('Groq stream: body ausente.');

        const decoder = new TextDecoder();
        const reader = streamResponse.body.getReader();
        let buffer = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split('\n\n');
          buffer = events.pop() ?? '';

          for (const event of events) {
            const lines = event
              .split('\n')
              .filter((l) => l.startsWith('data: '))
              .map((l) => l.slice(6));

            for (const line of lines) {
              if (line === '[DONE]') continue;
              const parsed = JSON.parse(line);
              const text = parsed?.choices?.[0]?.delta?.content ?? '';
              if (text) onChunk(text);
            }
          }
        }

        onDone();
        return;
      }

      // ── Executa tool calls ────────────────────────────────────────────────
      for (const toolCall of toolCalls) {
        const result = executeGroqTool(toolCall.function.name, toolCall.function.arguments, contextFiles);
        fullMessages.push({ role: 'tool', tool_call_id: toolCall.id, content: result });
      }
    }

    onError(new Error('Limite de iterações de tool use atingido.'));
  } catch (err) {
    onError(err instanceof Error ? err : new Error(String(err)));
  }
}
