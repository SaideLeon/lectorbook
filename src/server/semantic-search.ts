import { EMBEDDING_FALLBACK_MODEL, EMBEDDING_MODEL, getAIClient } from '@/server/gemini.service';

type ContextFile = { path: string; content: string };

type Chunk = {
  id: string;
  path: string;
  text: string;
  lexicalScore: number;
  semanticScore: number;
  finalScore: number;
};

const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 180;
const MAX_EMBED_CANDIDATES = 24;
const embeddingCache = new Map<string, number[]>();

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function tokenize(text: string): string[] {
  return normalize(text)
    .split(/[^a-z0-9_]+/)
    .filter((t) => t.length > 2);
}

function splitIntoChunks(content: string): string[] {
  const safe = content.replace(/\r\n/g, '\n');
  const chunks: string[] = [];
  let start = 0;

  while (start < safe.length) {
    const end = Math.min(start + CHUNK_SIZE, safe.length);
    chunks.push(safe.slice(start, end));
    if (end >= safe.length) break;
    start = Math.max(0, end - CHUNK_OVERLAP);
  }

  return chunks;
}

function lexicalScore(query: string, text: string): number {
  const qTokens = tokenize(query);
  if (!qTokens.length) return 0;

  const source = normalize(text);
  let hits = 0;
  for (const token of qTokens) {
    if (source.includes(token)) hits += 1;
  }

  const tokenCoverage = hits / qTokens.length;
  const phraseBoost = source.includes(normalize(query).trim()) ? 0.25 : 0;
  return Math.min(1, tokenCoverage + phraseBoost);
}

function dot(a: number[], b: number[]): number {
  let sum = 0;
  const length = Math.min(a.length, b.length);
  for (let i = 0; i < length; i += 1) sum += a[i] * b[i];
  return sum;
}

function magnitude(vec: number[]): number {
  let sum = 0;
  for (const n of vec) sum += n * n;
  return Math.sqrt(sum);
}

function cosineSimilarity(a: number[], b: number[]): number {
  const denom = magnitude(a) * magnitude(b);
  if (!denom) return 0;
  return dot(a, b) / denom;
}

async function embedText(
  text: string,
  apiKey?: string,
  taskType: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY' = 'RETRIEVAL_DOCUMENT',
): Promise<number[] | null> {
  const key = `${taskType}:${text.length}:${text.slice(0, 300)}`;
  if (embeddingCache.has(key)) return embeddingCache.get(key)!;

  const ai = getAIClient(apiKey);
  const modelsToTry = [EMBEDDING_MODEL, EMBEDDING_FALLBACK_MODEL].filter(
    (model, index, arr) => arr.indexOf(model) === index,
  );

  for (const model of modelsToTry) {
    try {
      const response: any = await ai.models.embedContent({
        model,
        contents: text,
        config: { taskType },
      });

      const values = response?.embeddings?.[0]?.values || response?.embedding?.values;
      if (!Array.isArray(values) || values.length === 0) continue;
      embeddingCache.set(key, values);
      return values;
    } catch {
      // tenta próximo modelo de embedding disponível para esta conta/chave
    }
  }

  return null;
}

export function createSearchQuery(currentInput: string, history: Array<{ role: string; content: string }> = []): string {
  const lastUserTurns = history
    .filter((h) => h.role === 'user')
    .slice(-2)
    .map((h) => h.content);

  return [...lastUserTurns, currentInput].filter(Boolean).join('\n');
}

export async function buildRelevantContext(options: {
  query: string;
  contextFiles: ContextFile[];
  apiKey?: string;
  maxChunks?: number;
}) {
  const { query, contextFiles, apiKey, maxChunks = 8 } = options;

  const chunks: Chunk[] = [];
  for (const file of contextFiles || []) {
    const parts = splitIntoChunks(file.content || '');
    parts.forEach((part, idx) => {
      const score = lexicalScore(query, part);
      chunks.push({
        id: `${file.path}#${idx}`,
        path: file.path,
        text: part,
        lexicalScore: score,
        semanticScore: 0,
        finalScore: score,
      });
    });
  }

  if (!chunks.length) {
    return { selectedChunks: [], renderedContext: 'Nenhum arquivo .md/.txt disponível.' };
  }

  const lexicalSorted = chunks.sort((a, b) => b.lexicalScore - a.lexicalScore);
  const embedCandidates = lexicalSorted.slice(0, MAX_EMBED_CANDIDATES);

  const queryEmbedding = await embedText(query, apiKey, 'RETRIEVAL_QUERY');
  if (queryEmbedding) {
    const vectors = await Promise.all(embedCandidates.map((c) => embedText(c.text, apiKey)));
    embedCandidates.forEach((chunk, i) => {
      const vec = vectors[i];
      if (!vec) return;
      chunk.semanticScore = Math.max(0, cosineSimilarity(queryEmbedding, vec));
      chunk.finalScore = chunk.lexicalScore * 0.35 + chunk.semanticScore * 0.65;
    });
  }

  const selectedChunks = lexicalSorted
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, maxChunks)
    .filter((c) => c.finalScore > 0.02 || c.lexicalScore > 0.05);

  const grouped = new Map<string, string[]>();
  for (const chunk of selectedChunks) {
    if (!grouped.has(chunk.path)) grouped.set(chunk.path, []);
    grouped.get(chunk.path)!.push(chunk.text.trim());
  }

  const renderedContext =
    selectedChunks.length > 0
      ? Array.from(grouped.entries())
          .map(([path, excerpts]) => `--- ${path} ---\n${excerpts.join('\n\n[...]\n\n')}`)
          .join('\n\n')
      : 'Nenhum trecho relevante encontrado para a pergunta.';

  return { selectedChunks, renderedContext };
}
