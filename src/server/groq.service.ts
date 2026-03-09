/**
 * src/server/groq.service.ts
 *
 * Serviço Groq: fallback para quando a Gemini retorna erros (500, 503, etc.)
 * Inclui definição de tools, executor de tools e chat com loop agêntico.
 *
 * Instale o SDK: npm install groq-sdk
 */

import Groq from 'groq-sdk';

// ─── Cliente ────────────────────────────────────────────────────────────────

let _groqClient: Groq | null = null;

export function getGroqClient(): Groq {
  if (!_groqClient) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('GROQ_API_KEY não configurada no ambiente.');
    _groqClient = new Groq({ apiKey });
  }
  return _groqClient;
}

// Modelos disponíveis com suporte a tool use
export const GROQ_PRIMARY_MODEL   = 'llama-3.3-70b-versatile';  // 128k ctx, tool use
export const GROQ_FALLBACK_MODEL  = 'llama3-groq-70b-8192-tool-use-preview'; // otimizado p/ tools

// ─── Definição das Tools ─────────────────────────────────────────────────────
//
// Tools permitem que a IA peça dados extras durante a resposta.
// A IA decide SE e QUANDO chamar cada tool — você não força a chamada.
//
// Formato: array de objetos { type: 'function', function: { name, description, parameters } }

export const LECTOR_TOOLS: Groq.Chat.Completions.ChatCompletionTool[] = [
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
          query: {
            type: 'string',
            description: 'Palavra-chave ou frase para buscar nos documentos.',
          },
          file_path: {
            type: 'string',
            description:
              'Caminho parcial do arquivo para restringir a busca (opcional). ' +
              'Ex: "modulo-1" vai filtrar arquivos cujo caminho contenha esse texto.',
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
        'Lista todos os arquivos de documentação (.md/.txt) disponíveis no repositório. ' +
        'Use para descobrir quais materiais existem antes de buscar conteúdo específico.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_document',
      description:
        'Retorna o conteúdo completo de um arquivo específico do repositório. ' +
        'Use quando souber exatamente qual arquivo precisa ler.',
      parameters: {
        type: 'object',
        properties: {
          file_path: {
            type: 'string',
            description: 'Caminho exato do arquivo. Ex: "modulos/modulo-1.md".',
          },
        },
        required: ['file_path'],
      },
    },
  },
];

// ─── Executor de Tools ────────────────────────────────────────────────────────
//
// Recebe o nome + argumentos da tool chamada pela IA e retorna uma string
// com o resultado — que será enviada de volta para a IA continuar a resposta.

export function executeGroqTool(
  toolName: string,
  rawArgs: string,
  contextFiles: { path: string; content: string }[],
): string {
  let args: Record<string, string> = {};
  try {
    args = JSON.parse(rawArgs || '{}');
  } catch {
    return 'Erro: argumentos inválidos fornecidos para a tool.';
  }

  // ── find_in_documents ──────────────────────────────────────────────────────
  if (toolName === 'find_in_documents') {
    const { query, file_path } = args;
    if (!query) return 'Erro: parâmetro "query" é obrigatório.';

    const lowerQuery = query.toLowerCase();
    const filesToSearch = file_path
      ? contextFiles.filter(f => f.path.toLowerCase().includes(file_path.toLowerCase()))
      : contextFiles;

    if (filesToSearch.length === 0)
      return `Nenhum arquivo encontrado${file_path ? ` com caminho contendo "${file_path}"` : ''}.`;

    const results: string[] = [];
    for (const file of filesToSearch) {
      const lines = file.content.split('\n');
      const matchingLines = lines
        .map((line, idx) => ({ line, idx }))
        .filter(({ line }) => line.toLowerCase().includes(lowerQuery));

      if (matchingLines.length > 0) {
        // Retorna até 8 linhas correspondentes com número de linha para contexto
        const excerpt = matchingLines
          .slice(0, 8)
          .map(({ line, idx }) => `L${idx + 1}: ${line.trim()}`)
          .join('\n');
        results.push(`=== ${file.path} (${matchingLines.length} ocorrência(s)) ===\n${excerpt}`);
      }
    }

    return results.length > 0
      ? results.join('\n\n')
      : `Nenhuma ocorrência de "${query}" encontrada nos documentos.`;
  }

  // ── list_documents ─────────────────────────────────────────────────────────
  if (toolName === 'list_documents') {
    if (contextFiles.length === 0)
      return 'Nenhum arquivo de documentação (.md/.txt) disponível no repositório.';

    const listing = contextFiles
      .map(f => {
        const lines = f.content.split('\n').length;
        return `- ${f.path}  (${lines} linhas)`;
      })
      .join('\n');

    return `Arquivos disponíveis (${contextFiles.length}):\n${listing}`;
  }

  // ── get_document ───────────────────────────────────────────────────────────
  if (toolName === 'get_document') {
    const { file_path } = args;
    if (!file_path) return 'Erro: parâmetro "file_path" é obrigatório.';

    const file = contextFiles.find(
      f => f.path === file_path || f.path.endsWith(file_path),
    );
    if (!file) return `Arquivo "${file_path}" não encontrado. Use list_documents para ver os disponíveis.`;

    // Retorna até 200 linhas para não explodir o contexto
    const lines = file.content.split('\n');
    const preview = lines.slice(0, 200).join('\n');
    const truncated = lines.length > 200 ? `\n\n[... ${lines.length - 200} linhas omitidas ...]` : '';

    return `=== ${file.path} ===\n${preview}${truncated}`;
  }

  return `Tool "${toolName}" não reconhecida.`;
}

// ─── Chat com Loop Agêntico + Streaming ──────────────────────────────────────
//
// Fluxo:
//   1. Chama Groq (sem stream) com tools habilitadas.
//   2. Se a IA pedir tools → executa cada tool → devolve resultado → repete.
//   3. Quando não há mais tool calls → emite a resposta final em stream.
//
// O loop tem no máximo MAX_TOOL_ITERATIONS para evitar ciclos infinitos.

const MAX_TOOL_ITERATIONS = 4;

export async function groqChatStream(options: {
  messages: Groq.Chat.Completions.ChatCompletionMessageParam[];
  systemInstruction: string;
  contextFiles: { path: string; content: string }[];
  onChunk: (text: string) => void;
  onDone: () => void;
  onError: (err: Error) => void;
}): Promise<void> {
  const { messages, systemInstruction, contextFiles, onChunk, onDone, onError } = options;
  const client = getGroqClient();

  const fullMessages: Groq.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemInstruction },
    ...messages,
  ];

  try {
    // ── Loop agêntico ────────────────────────────────────────────────────────
    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      // Chamada não-streaming para checar se há tool calls
      const response = await client.chat.completions.create({
        model: GROQ_PRIMARY_MODEL,
        messages: fullMessages,
        tools: LECTOR_TOOLS,
        tool_choice: 'auto',
        temperature: 0.7,
        max_tokens: 8192,
      });

      const choice = response.choices[0];
      const assistantMessage = choice.message;

      // Adiciona a resposta do assistente no histórico (necessário para o loop)
      fullMessages.push({
        role: 'assistant',
        content: assistantMessage.content ?? null,
        tool_calls: assistantMessage.tool_calls,
      });

      // Se não há tool calls → resposta final: faz streaming
      const toolCalls = assistantMessage.tool_calls;
      if (!toolCalls || toolCalls.length === 0) {
        // Re-faz a última mensagem em modo stream para emitir chunks
        // Remove a última mensagem do assistente que acabamos de adicionar
        const messagesForStream = fullMessages.slice(0, -1);

        const stream = await client.chat.completions.create({
          model: GROQ_PRIMARY_MODEL,
          messages: messagesForStream,
          temperature: 0.7,
          max_tokens: 8192,
          stream: true,
        });

        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content ?? '';
          if (text) onChunk(text);
        }

        onDone();
        return;
      }

      // Há tool calls → executa cada uma e adiciona resultado
      for (const toolCall of toolCalls) {
        const result = executeGroqTool(
          toolCall.function.name,
          toolCall.function.arguments,
          contextFiles,
        );

        // Mensagem de resultado da tool (obrigatório ter tool_call_id)
        fullMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: result,
        });
      }
      // Continua o loop com as mensagens atualizadas
    }

    // Esgotou as iterações — responde com o que tiver
    onError(new Error('Limite de iterações de tool use atingido.'));
  } catch (err) {
    onError(err instanceof Error ? err : new Error(String(err)));
  }
}
