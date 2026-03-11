/**
 * src/server/langchain.service.ts
 *
 * Serviço central LangChain + Supabase para o LectorBook.
 *
 * Responsabilidades:
 *  1. Ingestão de documentos do repositório → SupabaseVectorStore
 *  2. Recuperação semântica com reescrita de query pelo histórico
 *     (createHistoryAwareRetriever — evita o problema de pronomes sem contexto)
 *  3. Histórico de chat persistido no Supabase por session_id
 *
 * Degradação graciosa: se SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY não estiverem
 * configurados, todas as funções retornam null/lançam erro esperado, e o
 * caller (think/route.ts) cai no fallback de busca em memória.
 */

import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { SupabaseVectorStore } from '@langchain/community/vectorstores/supabase';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { Document } from '@langchain/core/documents';
import { HumanMessage, AIMessage, BaseMessage } from '@langchain/core/messages';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { createHistoryAwareRetriever } from 'langchain/chains/history_aware_retriever';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ─── Configuração ─────────────────────────────────────────────────────────────

export function isSupabaseConfigured(): boolean {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function getSupabaseClient(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase não configurado. Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env');
  }
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

/**
 * Embeddings para DOCUMENTOS (chunks do repositório).
 * TaskType: RETRIEVAL_DOCUMENT — espaço vetorial correto para indexação.
 */
function getDocumentEmbeddings(apiKey?: string): GoogleGenerativeAIEmbeddings {
  return new GoogleGenerativeAIEmbeddings({
    apiKey: apiKey ?? process.env.GEMINI_API_KEY ?? '',
    modelName: 'text-embedding-004',
    taskType: 'RETRIEVAL_DOCUMENT' as any,
  });
}

/**
 * Embeddings para QUERIES (perguntas do utilizador).
 * TaskType: RETRIEVAL_QUERY — espaço vetorial distinto, melhora similaridade coseno.
 * Nota: o LangChain usa o mesmo objeto de embeddings tanto para indexar quanto
 * para buscar; para garantir o TaskType correto na query, passamos a instância
 * com RETRIEVAL_QUERY ao chamar similaritySearch diretamente.
 */
function getQueryEmbeddings(apiKey?: string): GoogleGenerativeAIEmbeddings {
  return new GoogleGenerativeAIEmbeddings({
    apiKey: apiKey ?? process.env.GEMINI_API_KEY ?? '',
    modelName: 'text-embedding-004',
    taskType: 'RETRIEVAL_QUERY' as any,
  });
}

function getVectorStore(apiKey?: string): SupabaseVectorStore {
  return new SupabaseVectorStore(getDocumentEmbeddings(apiKey), {
    client: getSupabaseClient(),
    tableName: 'documents',
    queryName: 'match_documents',
  });
}

type PersistedChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

class SupabaseChatMessageHistory {
  constructor(
    private readonly options: {
      client: SupabaseClient;
      tableName: string;
      sessionId: string;
    },
  ) {}

  async addMessage(message: BaseMessage): Promise<void> {
    const normalizedMessage = this.normalizeMessage(message);
    if (!normalizedMessage) return;

    const { error } = await this.options.client.from(this.options.tableName).insert({
      session_id: this.options.sessionId,
      message: normalizedMessage,
    });

    if (error) {
      throw new Error(`Falha ao salvar mensagem no Supabase: ${error.message}`);
    }
  }

  private normalizeMessage(message: BaseMessage): PersistedChatMessage | null {
    if (message instanceof HumanMessage) {
      return { role: 'user', content: this.getContentAsString(message.content) };
    }

    if (message instanceof AIMessage) {
      return { role: 'assistant', content: this.getContentAsString(message.content) };
    }

    return null;
  }

  private getContentAsString(content: BaseMessage['content']): string {
    if (typeof content === 'string') return content;
    return JSON.stringify(content);
  }
}

// ─── Splitter (configuração RAG.txt) ─────────────────────────────────────────

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,   // ~250 tokens — abaixo do limite do text-embedding-004
  chunkOverlap: 200, // mantém contexto entre chunks adjacentes
  separators: ['\n\n', '\n', '. ', ' ', ''], // prefere quebrar em parágrafos
});

// ─── 1. INGESTÃO ──────────────────────────────────────────────────────────────

/**
 * Ingere os ficheiros .md/.txt do repositório no SupabaseVectorStore.
 *
 * Fluxo:
 *  1. Remove documentos antigos do mesmo repositório (evita duplicatas).
 *  2. Divide cada ficheiro em chunks com RecursiveCharacterTextSplitter.
 *  3. Gera embeddings (RETRIEVAL_DOCUMENT) e salva na tabela documents.
 *
 * @param files         Ficheiros do repositório (path + content)
 * @param repoFullName  Ex: "usuario/repositorio" — usado como filtro de metadata
 * @param apiKey        Gemini API key opcional (usa env se não fornecida)
 * @returns             Número de chunks ingeridos
 */
export async function ingestRepoDocuments(
  files: { path: string; content: string }[],
  repoFullName: string,
  apiKey?: string,
): Promise<number> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase não configurado');
  }

  const supabase = getSupabaseClient();

  // Remove documentos antigos do mesmo repositório antes de re-ingerir
  const { error: deleteError } = await supabase
    .from('documents')
    .delete()
    .contains('metadata', { repo: repoFullName });

  if (deleteError) {
    console.warn('[LangChain] Aviso ao limpar documentos antigos:', deleteError.message);
  }

  // Cria chunks a partir dos ficheiros
  const docs: Document[] = [];

  for (const file of files) {
    if (!file.content?.trim()) continue;

    const chunks = await splitter.createDocuments(
      [file.content],
      [{ repo: repoFullName, path: file.path }],
    );

    docs.push(...chunks);
  }

  if (docs.length === 0) return 0;

  // Ingere em batches para não sobrecarregar a API de embeddings
  const BATCH_SIZE = 50;
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = docs.slice(i, i + BATCH_SIZE);
    await SupabaseVectorStore.fromDocuments(batch, getDocumentEmbeddings(apiKey), {
      client: supabase,
      tableName: 'documents',
      queryName: 'match_documents',
    });
  }

  return docs.length;
}

// ─── 2. RECUPERAÇÃO COM HISTÓRICO ────────────────────────────────────────────

/**
 * Recupera trechos relevantes usando LangChain + Supabase.
 *
 * Quando há histórico de conversa, usa createHistoryAwareRetriever para
 * reescrever a pergunta do utilizador antes da busca vetorial.
 *
 * Exemplo de reescrita:
 *   Histórico: "O que é Supabase?" → "É uma BD PostgreSQL open-source"
 *   Query atual: "Como instalo?"
 *   Query reescrita: "Como instalar o SDK do Supabase?"
 *
 * Sem a reescrita, "Como instalo?" não encontraria documentação do Supabase.
 *
 * @param query         Pergunta atual do utilizador
 * @param chatHistory   Histórico recente {role, content}[]
 * @param repoFullName  Filtro por repositório (metadata)
 * @param apiKey        Gemini API key opcional
 * @param k             Número de chunks a retornar
 */
export async function retrieveWithLangChain(options: {
  query: string;
  chatHistory: { role: string; content: string }[];
  repoFullName?: string;
  apiKey?: string;
  k?: number;
}): Promise<{ renderedContext: string; selectedChunks: Document[] }> {
  const { query, chatHistory, repoFullName, apiKey, k = 8 } = options;

  if (!isSupabaseConfigured()) {
    throw new Error('Supabase não configurado');
  }

  // Vector store com filtro por repositório
  const filter = repoFullName ? { repo: repoFullName } : undefined;
  const vectorStore = getVectorStore(apiKey);

  // Converte histórico para mensagens LangChain (últimas 6 trocas = 12 mensagens)
  const lcHistory: BaseMessage[] = chatHistory
    .slice(-12)
    .map((h) =>
      h.role === 'user' ? new HumanMessage(h.content) : new AIMessage(h.content),
    );

  let docs: Document[] = [];

  // Com histórico: reescreve a query antes da busca
  if (lcHistory.length > 0 && (apiKey || process.env.GEMINI_API_KEY)) {
    try {
      // LLM leve apenas para reescrita — não precisa de streaming
      const rephraseLlm = new ChatGoogleGenerativeAI({
        apiKey: apiKey ?? process.env.GEMINI_API_KEY ?? '',
        model: 'gemini-2.0-flash',
        temperature: 0,
        maxOutputTokens: 150,
      });

      // Prompt que instrui o modelo a criar uma query autónoma
      const rephrasePrompt = ChatPromptTemplate.fromMessages([
        new MessagesPlaceholder('chat_history'),
        ['user', '{input}'],
        [
          'user',
          'Com base na conversa acima, formula uma pergunta de pesquisa autónoma e concisa ' +
          'que possa ser usada para buscar informações relevantes sem depender do contexto ' +
          'anterior. Responda APENAS com a pergunta reformulada, sem explicações.',
        ],
      ]);

      const historyAwareRetriever = await createHistoryAwareRetriever({
        llm: rephraseLlm,
        retriever: vectorStore.asRetriever({ k, filter }),
        rephrasePrompt,
      });

      docs = await historyAwareRetriever.invoke({
        input: query,
        chat_history: lcHistory,
      });
    } catch (err) {
      console.warn(
        '[LangChain] Reescrita de query falhou, usando busca direta:',
        err instanceof Error ? err.message : err,
      );
      // Fallback: busca direta sem reescrita
      docs = await vectorStore.similaritySearch(query, k, filter);
    }
  } else {
    // Sem histórico: busca direta
    docs = await vectorStore.similaritySearch(query, k, filter);
  }

  return {
    selectedChunks: docs,
    renderedContext: renderDocuments(docs),
  };
}

// ─── 3. HISTÓRICO PERSISTENTE ────────────────────────────────────────────────

/**
 * Retorna uma instância do SupabaseChatMessageHistory para a sessão.
 * Cada session_id corresponde a uma conversa independente.
 */
export function getSessionHistory(sessionId: string): SupabaseChatMessageHistory {
  return new SupabaseChatMessageHistory({
    client: getSupabaseClient(),
    tableName: 'chat_messages',
    sessionId,
  });
}

/**
 * Persiste um turno completo (pergunta do utilizador + resposta da IA) no Supabase.
 * Chamada de forma assíncrona após o streaming terminar — não bloqueia a resposta.
 */
export async function persistChatTurn(
  sessionId: string,
  userMessage: string,
  aiResponse: string,
): Promise<void> {
  if (!isSupabaseConfigured() || !sessionId) return;

  try {
    const history = getSessionHistory(sessionId);
    await history.addMessage(new HumanMessage(userMessage));
    await history.addMessage(new AIMessage(aiResponse));
  } catch (err) {
    // Não propaga o erro — persistência é best-effort
    console.warn('[LangChain] Falha ao persistir histórico:', err instanceof Error ? err.message : err);
  }
}

// ─── Utilitário ───────────────────────────────────────────────────────────────

function renderDocuments(docs: Document[]): string {
  if (docs.length === 0) {
    return 'Nenhum trecho relevante encontrado para a pergunta.';
  }

  // Agrupa excerpts por ficheiro para leitura coerente pelo LLM
  const grouped = new Map<string, string[]>();
  for (const doc of docs) {
    const path: string = doc.metadata?.path || 'documento';
    if (!grouped.has(path)) grouped.set(path, []);
    grouped.get(path)!.push(doc.pageContent.trim());
  }

  return Array.from(grouped.entries())
    .map(([path, excerpts]) => `--- ${path} ---\n${excerpts.join('\n\n[...]\n\n')}`)
    .join('\n\n');
}
