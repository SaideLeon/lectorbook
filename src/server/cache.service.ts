const DEFAULT_TTL_MS = 12 * 60 * 60 * 1000;

interface CacheEntry<T> {
  data: T;
  createdAt: number;
}

const treeCache = new Map<string, CacheEntry<any>>();
const fileCache = new Map<string, CacheEntry<string>>();

function isExpired(entry: CacheEntry<unknown>, ttlMs: number) {
  return Date.now() - entry.createdAt > ttlMs;
}

export const cacheService = {
  getTree(owner: string, repo: string, branch: string, ttlMs: number = DEFAULT_TTL_MS) {
    const id = `${owner}/${repo}/${branch}`;
    const entry = treeCache.get(id);
    if (!entry) return null;
    if (isExpired(entry, ttlMs)) {
      treeCache.delete(id);
      return null;
    }
    return entry.data;
  },

  setTree(owner: string, repo: string, branch: string, data: any) {
    const id = `${owner}/${repo}/${branch}`;
    treeCache.set(id, { data, createdAt: Date.now() });
  },

  getFileContent(owner: string, repo: string, branch: string, filePath: string, ttlMs: number = DEFAULT_TTL_MS) {
    const id = `${owner}/${repo}/${branch}/${filePath}`;
    const entry = fileCache.get(id);
    if (!entry) return null;
    if (isExpired(entry, ttlMs)) {
      fileCache.delete(id);
      return null;
    }
    return entry.data;
  },

  setFileContent(owner: string, repo: string, branch: string, filePath: string, content: string) {
    const id = `${owner}/${repo}/${branch}/${filePath}`;
    fileCache.set(id, { data: content, createdAt: Date.now() });
  },
};
