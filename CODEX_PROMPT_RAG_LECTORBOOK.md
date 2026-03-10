# Prompt para Codex — Implementar RAG Semântico no Lectorbook

## Contexto do Projeto

O **Lectorbook** é uma aplicação Next.js 15 (App Router) + React 19 que analisa repositórios GitHub usando IA (Google Gemini + Groq como fallback). O stack é TypeScript puro, sem banco de dados — tudo em memória ou cache local.

O problema atual: quando um repositório tem muitos arquivos `.md` e `.txt`, todos são enviados de uma vez como contexto para o Gemini, o que desperdiça tokens e degrada a qualidade das respostas. A solução é implementar um sistema **RAG (Retrieval-Augmented Generation) semântico** usando embeddings locais via `@xenova/transformers`, sem nenhuma API externa.

---

## Objetivo

Implementar RAG semântico completo integrado ao fluxo existente do Lectorbook, com as seguintes características:

- **Embeddings locais** com `@xenova/transformers` (modelo `Xenova/all-MiniLM-L6-v2`, ~23MB, gratuito, sem API)
- **Zero breaking changes** — o sistema funciona como fallback silencioso; se o RAG não estiver pronto, usa o comportamento atual
- **Cache por repositório** — embeddings gerados uma vez por sessão de servidor
- **Chunking inteligente** — divide documentos grandes em pedaços de ~500 tokens com overlap
- **Recuperação top-K** — retorna os 5 chunks mais relevantes por pergunta via similaridade coseno

---

## Arquitetura da Solução

### Novos arquivos a criar

```
src/server/rag/
  embedder.ts          # Singleton do pipeline Xenova, inicialização lazy
  chunker.ts           # Divide texto em chunks com overlap
  rag.service.ts       # Orquestra: indexar docs + recuperar chunks relevantes
  vector-store.ts      # Store em memória: Map<repoKey, ChunkEntry[]>
```

### Arquivos existentes a modificar

```
src/app/api/ai/think/route.ts    # Usar RAG antes de montar o contexto
src/app/api/ai/analyze/route.ts  # Idem para análise inicial
src/server/groq.service.ts       # Passar contextFiles já filtrados pelo RAG
package.json                     # Adicionar @xenova/transformers
```

---

## Implementação Detalhada

### 1. `src/server/rag/embedder.ts`

Singleton que carrega o modelo uma única vez. Usar inicialização lazy para não bloquear o cold start do servidor.

```typescript
import { pipeline, Pipeline } from '@xenova/transformers';

let _embedder: Pipeline | null = null;
let _loading: Promise<Pipeline> | null = null;

export async function getEmbedder(): Promise<Pipeline> {
  if (_embedder) return _embedder;
  if (_loading) return _loading;

  _loading = pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
    quantized: true, // usa versão int8 quantizada (~23MB vs ~90MB)
  }).then((p) => {
    _embedder = p;
    _loading = null;
    return p;
  });

  return _loading;
}

export async function embed(text: string): Promise<number[]> {
  const embedder = await getEmbedder();
  const output = await embedder(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data as Float32Array);
}
```

**Requisitos:**
- Usar `quantized: true` para menor uso de memória
- O modelo é baixado automaticamente para `~/.cache/huggingface` na primeira execução
- Não expor o singleton para fora do módulo, apenas a função `embed`

---

### 2. `src/server/rag/chunker.ts`

Divide um documento em chunks de tamanho controlado com overlap para preservar contexto entre chunks.

```typescript
export interface Chunk {
  text: string;
  path: string;
  index: number;      // posição do chunk no documento
  totalChunks: number;
}

export function chunkDocument(
  content: string,
  path: string,
  options?: {
    maxTokens?: number;  // padrão: 500
    overlap?: number;    // padrão: 50 tokens de overlap
  }
): Chunk[] { ... }
```

**Lógica de chunking:**
1. Dividir por parágrafos (`\n\n`) como primeira estratégia
2. Se um parágrafo ainda for maior que `maxTokens`, dividir por sentenças (`. `) 
3. Acumular parágrafos/sentenças até atingir `maxTokens`, então criar chunk
4. O próximo chunk começa `overlap` tokens antes do fim do atual
5. Estimar tokens como `text.length / 4` (aproximação simples, suficiente)

**Regras importantes:**
- Nunca criar chunk com menos de 50 tokens (muito curto para ser útil)
- Incluir sempre o `path` do arquivo no chunk para rastreabilidade
- Documentos menores que `maxTokens` viram um único chunk

---

### 3. `src/server/rag/vector-store.ts`

Store em memória simples com Map. Não usar nenhuma dependência de banco de dados.

```typescript
export interface ChunkEntry {
  chunk: Chunk;
  embedding: number[];
}

export interface RepoIndex {
  entries: ChunkEntry[];
  createdAt: number;
  repoKey: string;
}

// TTL: 12 horas, alinhado com o cache de arquivos existente em cache.service.ts
const STORE_TTL_MS = 12 * 60 * 60 * 1000;

class VectorStore {
  private store = new Map<string, RepoIndex>();

  set(repoKey: string, entries: ChunkEntry[]): void { ... }
  get(repoKey: string): ChunkEntry[] | null { ... }  // null se expirado
  has(repoKey: string): boolean { ... }
  delete(repoKey: string): void { ... }
  clear(): void { ... }
}

export const vectorStore = new VectorStore();
```

---

### 4. `src/server/rag/rag.service.ts`

Orquestra indexação e recuperação. Esta é a API pública do módulo RAG.

```typescript
import { embed } from './embedder';
import { chunkDocument, Chunk } from './chunker';
import { vectorStore, ChunkEntry } from './vector-store';

// Chave única por repositório
function makeRepoKey(owner: string, repo: string, headSha: string): string {
  return `${owner}/${repo}@${headSha}`;
}

// Similaridade coseno entre dois vetores normalizados
function cosineSimilarity(a: number[], b: number[]): number {
  // Como os vetores já são normalizados pelo embedder (normalize: true),
  // a similaridade coseno é simplesmente o produto escalar
  return a.reduce((sum, v, i) => sum + v * b[i], 0);
}

/**
 * Indexa os documentos de um repositório.
 * Gera chunks e embeddings de todos os arquivos fornecidos.
 * Idempotente: se o repoKey já estiver indexado, retorna imediatamente.
 */
export async function indexRepository(
  owner: string,
  repo: string,
  headSha: string,
  files: { path: string; content: string }[]
): Promise<void> {
  const repoKey = makeRepoKey(owner, repo, headSha);
  if (vectorStore.has(repoKey)) return; // já indexado

  const allChunks: { path: string; content: string }[] = files.flatMap((f) =>
    chunkDocument(f.content, f.path)
  );

  const entries: ChunkEntry[] = await Promise.all(
    allChunks.map(async (chunk) => ({
      chunk,
      embedding: await embed(chunk.text),
    }))
  );

  vectorStore.set(repoKey, entries);
}

/**
 * Recupera os top-K chunks mais relevantes para uma query.
 * Retorna os arquivos no formato esperado pelas rotas de AI existentes.
 */
export async function retrieveRelevantChunks(
  owner: string,
  repo: string,
  headSha: string,
  query: string,
  topK = 5
): Promise<{ path: string; content: string }[]> {
  const repoKey = makeRepoKey(owner, repo, headSha);
  const entries = vectorStore.get(repoKey);

  // Se não indexado (cold start ou TTL expirado), retorna vazio
  // A rota vai usar os contextFiles originais como fallback
  if (!entries || entries.length === 0) return [];

  const queryEmbedding = await embed(query);

  const scored = entries.map((entry) => ({
    entry,
    score: cosineSimilarity(queryEmbedding, entry.embedding),
  }));

  scored.sort((a, b) => b.score - a.score);

  // Agrupar chunks do mesmo arquivo que foram selecionados
  // para manter coerência do contexto
  const topChunks = scored.slice(0, topK);

  return topChunks.map(({ entry }) => ({
    path: entry.chunk.path,
    content: entry.chunk.text,
  }));
}

/**
 * Invalida o índice de um repositório.
 * Chamar quando o repositório for atualizado (novo headSha).
 */
export function invalidateRepoIndex(owner: string, repo: string, headSha: string): void {
  vectorStore.delete(makeRepoKey(owner, repo, headSha));
}
```

---

### 5. Modificar `src/app/api/ai/think/route.ts`

Esta é a rota de chat — onde o RAG tem mais impacto. Modificar para:

1. Extrair `owner`, `repo` e `headSha` do body da requisição (adicionar esses campos)
2. Tentar recuperar chunks relevantes via RAG
3. Se RAG retornar resultados, usá-los como `contextFiles`; caso contrário, usar os `contextFiles` originais

**Campos adicionais no body da requisição:**
```typescript
const {
  history,
  currentInput,
  context,
  contextFiles = [],
  apiKey,
  owner,      // novo
  repo,       // novo
  headSha,    // novo
} = await req.json();
```

**Lógica de seleção de contexto:**
```typescript
let effectiveContextFiles = contextFiles;

if (owner && repo && headSha && currentInput) {
  try {
    const ragChunks = await retrieveRelevantChunks(owner, repo, headSha, currentInput, 5);
    if (ragChunks.length > 0) {
      effectiveContextFiles = ragChunks;
    }
  } catch (ragError) {
    // RAG falhou silenciosamente — usar contextFiles original
    console.warn('[RAG] Falha ao recuperar chunks:', ragError);
  }
}

// Usar effectiveContextFiles no lugar de contextFiles para montar docsContext
```

---

### 6. Modificar `src/app/api/ai/analyze/route.ts`

Adicionar indexação assíncrona dos documentos logo após receber o request. A indexação roda em background — não bloqueia a resposta de análise.

**Campos adicionais no body:**
```typescript
const { prompt, contextFiles, apiKey, owner, repo, headSha } = await req.json();
```

**Disparar indexação em background:**
```typescript
// Indexar em background sem await — não bloqueia a resposta
if (owner && repo && headSha && contextFiles?.length > 0) {
  indexRepository(owner, repo, headSha, contextFiles).catch((err) => {
    console.warn('[RAG] Falha na indexação em background:', err);
  });
}
```

---

### 7. Modificar `src/services/ai.ts`

Passar os novos campos `owner`, `repo` e `headSha` nas chamadas às rotas de AI.

**`analyzeCode`** — adicionar parâmetro opcional:
```typescript
export async function analyzeCode(
  files: { path: string; content: string }[],
  userQuery?: string,
  apiKey?: string,
  repoMeta?: { owner: string; repo: string; headSha: string }
)
```

**`thinkAndSuggestStream`** — adicionar parâmetro opcional:
```typescript
export async function thinkAndSuggestStream(
  history: ...,
  currentInput: string,
  context: string,
  contextFiles: ...,
  callbacks: ...,
  apiKey?: string,
  repoMeta?: { owner: string; repo: string; headSha: string }
)
```

Incluir `repoMeta` no body JSON de ambas as chamadas se fornecido.

---

### 8. Modificar `src/hooks/useAIChat.ts`

Passar `repoMeta` nas chamadas `analyzeCode` e `thinkAndSuggestStream`. O hook precisa receber `repoMeta` como parâmetro ou via contexto.

**Opção recomendada:** adicionar parâmetro `repoMeta` no hook:

```typescript
export function useAIChat(repoMeta?: { owner: string; repo: string; headSha: string }) {
  // ...
}
```

Passar `repoMeta` para `performInitialAnalysis` e `sendMessage`.

---

### 9. Modificar `src/App.tsx`

Extrair `owner`, `repo` e `headSha` do estado do repositório e passar para `useAIChat`.

O `useGithubRepository` já retorna `headSha` implicitamente — expô-lo:

```typescript
// Em useGithubRepository, adicionar ao return:
headSha,
owner,  // extraído da URL no momento da análise
repo,   // extraído da URL no momento da análise
```

Em `App.tsx`:
```typescript
const { ..., headSha, owner, repo } = useGithubRepository(...);

const repoMeta = owner && repo && headSha
  ? { owner, repo, headSha }
  : undefined;

const { ... } = useAIChat(repoMeta);
```

---

### 10. Adicionar dependência

```bash
npm install @xenova/transformers
```

**Em `package.json`**, adicionar em `dependencies`:
```json
"@xenova/transformers": "^2.17.2"
```

**Em `next.config.ts`**, adicionar configuração para o webpack não tentar resolver módulos nativos do Xenova:
```typescript
const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ['@xenova/transformers'],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...(config.externals || []), '@xenova/transformers'];
    }
    return config;
  },
};
```

---

## Contratos de Dados — Resumo

### Novo campo no body de `/api/ai/think` e `/api/ai/analyze`
```typescript
{
  // campos existentes...
  owner?: string;    // ex: "saideomar"
  repo?: string;     // ex: "lectorbook"
  headSha?: string;  // ex: "a3f9c2d..."
}
```

### Interface interna `ChunkEntry`
```typescript
interface ChunkEntry {
  chunk: {
    text: string;
    path: string;
    index: number;
    totalChunks: number;
  };
  embedding: number[]; // float32[], length = 384 (dimensão do MiniLM-L6)
}
```

---

## Comportamento Esperado

| Cenário | Comportamento |
|---|---|
| Primeira pergunta após carregar repositório | RAG indexa em background durante `/analyze`; `/think` pode usar contextFiles original na primeira chamada |
| Segunda pergunta em diante | RAG já indexado, recupera top-5 chunks relevantes |
| Repositório atualizado (novo headSha) | Índice antigo expira, novo é criado na próxima indexação |
| Modelo não carregado ainda (cold start) | `retrieveRelevantChunks` retorna `[]`, fallback para contextFiles original |
| Erro no RAG (qualquer tipo) | Catch silencioso, fallback para contextFiles original |
| Repositório sem arquivos .md/.txt | RAG indexa array vazio, retorna `[]`, sem impacto |

---

## Testes Manuais para Validar

Após implementar, verificar no console do servidor:

1. **Indexação**: na primeira análise de um repo com `.md`, deve aparecer log indicando quantos chunks foram gerados
2. **Recuperação**: no chat, o log deve mostrar qual contexto foi selecionado pelo RAG vs original
3. **Fallback**: remover temporariamente `owner` do body e confirmar que o chat continua funcionando normalmente
4. **Performance**: a segunda pergunta deve ser mais rápida que a primeira (modelo já carregado)

Adicionar logs informativos (não verbosos) nas operações principais:
```typescript
console.log(`[RAG] Indexados ${entries.length} chunks para ${repoKey}`);
console.log(`[RAG] Recuperados ${ragChunks.length} chunks para query: "${currentInput.slice(0, 50)}..."`);
```

---

## Restrições e Decisões de Design

- **Não usar workers**: o Xenova roda na thread principal do Node.js. Para o volume do Lectorbook, é suficiente
- **Não persistir embeddings em disco**: memória é suficiente para sessão de servidor; disco adicionaria complexidade desnecessária
- **Não alterar tipos em `src/types.ts`**: os tipos existentes (`FileNode`, `AnalysisMessage`) não precisam mudar
- **Não quebrar o build**: todo código novo deve passar em `tsc --noEmit` (o comando `npm run lint` do projeto)
- **Compatibilidade**: o modelo `all-MiniLM-L6-v2` gera embeddings de 384 dimensões — hardcodar isso como constante é aceitável
- **Segurança**: `headSha` vindo do cliente deve ser tratado como string opaca, não executado nem interpretado

---

## Ordem de Implementação Sugerida

1. `package.json` + `next.config.ts` — dependência e config webpack
2. `src/server/rag/embedder.ts` — base de tudo
3. `src/server/rag/chunker.ts` — independente
4. `src/server/rag/vector-store.ts` — independente
5. `src/server/rag/rag.service.ts` — depende dos anteriores
6. `src/app/api/ai/analyze/route.ts` — adicionar indexação em background
7. `src/app/api/ai/think/route.ts` — adicionar recuperação RAG
8. `src/services/ai.ts` — passar repoMeta
9. `src/hooks/useGithubRepository.ts` — expor owner, repo, headSha
10. `src/hooks/useAIChat.ts` — receber e usar repoMeta
11. `src/App.tsx` — conectar os dois hooks
