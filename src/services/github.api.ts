import { RepoTreeResponse } from '@/types';

const fileCache = new Map<string, string>();

export const githubApi = {
  async getUserRepos(): Promise<any[]> {
    const res = await fetch('/api/github/repos');
    if (!res.ok) {
      let errorMsg = "Falha ao buscar repositórios";
      try {
        const errData = await res.json();
        errorMsg = errData.error || errData.message || errorMsg;
      } catch {
        errorMsg += ` (${res.status} ${res.statusText})`;
      }
      throw new Error(errorMsg);
    }
    return res.json();
  },

  async getTree(owner: string, repo: string): Promise<RepoTreeResponse> {
    const res = await fetch(`/api/github/tree?owner=${owner}&repo=${repo}`);

    if (!res.ok) {
      let errorMsg = "Falha ao buscar repositório.";
      try {
        const errData = await res.json();
        errorMsg = errData.error || errData.message || errorMsg;
      } catch {
        errorMsg += ` (${res.status} ${res.statusText})`;
      }

      if (res.status === 404) {
        errorMsg = "Repositório não encontrado ou privado. Esta ferramenta suporta apenas repositórios públicos.";
      } else if (res.status === 403) {
        errorMsg = "Limite de taxa da API do GitHub excedido. Tente novamente mais tarde.";
      }

      throw new Error(errorMsg);
    }

    const contentType = res.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error('Recebeu resposta não-JSON do servidor. Verifique se o servidor está rodando corretamente.');
    }

    return res.json();
  },

  async getFileContent(owner: string, repo: string, path: string, branch: string): Promise<string> {
    const cacheKey = `${owner}/${repo}/${branch}/${path}`;
    if (fileCache.has(cacheKey)) {
      return fileCache.get(cacheKey)!;
    }

    const res = await fetch(`/api/github/content?owner=${owner}&repo=${repo}&path=${path}&branch=${branch}`);
    if (!res.ok) throw new Error('Falha ao buscar arquivo');

    const text = await res.text();
    fileCache.set(cacheKey, text);
    return text;
  },

  clearCache() {
    fileCache.clear();
  }
};
