import type { Chunk } from './chunker';

export interface ChunkEntry {
  chunk: Chunk;
  embedding: number[];
}

export interface RepoIndex {
  entries: ChunkEntry[];
  createdAt: number;
  repoKey: string;
}

const STORE_TTL_MS = 12 * 60 * 60 * 1000;

class VectorStore {
  private store = new Map<string, RepoIndex>();

  set(repoKey: string, entries: ChunkEntry[]): void {
    this.store.set(repoKey, {
      entries,
      createdAt: Date.now(),
      repoKey,
    });
  }

  get(repoKey: string): ChunkEntry[] | null {
    const index = this.store.get(repoKey);
    if (!index) return null;

    if (Date.now() - index.createdAt > STORE_TTL_MS) {
      this.store.delete(repoKey);
      return null;
    }

    return index.entries;
  }

  has(repoKey: string): boolean {
    return this.get(repoKey) !== null;
  }

  delete(repoKey: string): void {
    this.store.delete(repoKey);
  }

  clear(): void {
    this.store.clear();
  }
}

export const vectorStore = new VectorStore();
