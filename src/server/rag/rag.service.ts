import { embed } from './embedder';
import { chunkDocument } from './chunker';
import { vectorStore, type ChunkEntry } from './vector-store';

interface RepoMeta {
  owner: string;
  repo: string;
  headSha: string;
}

export function makeRepoKey(owner: string, repo: string, headSha: string): string {
  return `${owner}/${repo}@${headSha}`;
}

function cosineSimilarity(a: number[], b: number[]): number {
  return a.reduce((sum, v, i) => sum + v * (b[i] ?? 0), 0);
}

function isValidRepoMeta(meta?: Partial<RepoMeta>): meta is RepoMeta {
  return Boolean(meta?.owner && meta.repo && meta.headSha);
}

export async function indexRepositoryDocuments(
  repoMeta: Partial<RepoMeta> | undefined,
  docs: { path: string; content: string }[],
): Promise<void> {
  if (!isValidRepoMeta(repoMeta)) return;

  const repoKey = makeRepoKey(repoMeta.owner, repoMeta.repo, repoMeta.headSha);
  if (vectorStore.has(repoKey)) return;

  const chunks = docs.flatMap((doc) => chunkDocument(doc.content, doc.path));
  const entries: ChunkEntry[] = [];

  for (const chunk of chunks) {
    try {
      const embedding = await embed(chunk.text);
      entries.push({ chunk, embedding });
    } catch (error) {
      console.warn('[RAG] Falha ao gerar embedding de chunk:', error);
    }
  }

  vectorStore.set(repoKey, entries);
  console.log(`[RAG] Indexados ${entries.length} chunks para ${repoKey}`);
}

export async function retrieveRelevantChunks(
  repoMeta: Partial<RepoMeta> | undefined,
  query: string,
  topK = 5,
): Promise<{ path: string; content: string }[]> {
  if (!isValidRepoMeta(repoMeta)) return [];

  const repoKey = makeRepoKey(repoMeta.owner, repoMeta.repo, repoMeta.headSha);
  const entries = vectorStore.get(repoKey);
  if (!entries || entries.length === 0) return [];

  try {
    const queryEmbedding = await embed(query);
    const ranked = entries
      .map((entry) => ({
        entry,
        score: cosineSimilarity(queryEmbedding, entry.embedding),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(({ entry }) => ({ path: entry.chunk.path, content: entry.chunk.text }));

    console.log(`[RAG] Recuperados ${ranked.length} chunks para query: "${query.slice(0, 50)}..."`);
    return ranked;
  } catch (error) {
    console.warn('[RAG] Falha na recuperação semântica:', error);
    return [];
  }
}

export function warmupRepositoryIndex(
  repoMeta: Partial<RepoMeta> | undefined,
  docs: { path: string; content: string }[],
): void {
  void indexRepositoryDocuments(repoMeta, docs).catch((err) => {
    console.warn('[RAG] Falha na indexação em background:', err);
  });
}
