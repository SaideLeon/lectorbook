import { RepoTreeResponse, SelectedFile } from '@/types';

const textFileCache = new Map<string, string>();
const pdfFileCache = new Map<string, string>();

const getAuthHeaders = () => {
  const token = localStorage.getItem('github_token');
  return token ? { 'x-github-token': token } : {};
};

export const githubApi = {
  async getUserRepos(): Promise<any[]> {
    const headers = getAuthHeaders();
    if (!headers['x-github-token']) return [];

    const res = await fetch('/api/github/repos', { headers });
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
    const res = await fetch(`/api/github/tree?owner=${owner}&repo=${repo}`, {
      headers: getAuthHeaders()
    });
    
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

    const contentType = res.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      throw new Error("Recebeu resposta não-JSON do servidor. Verifique se o servidor está rodando corretamente.");
    }

    return res.json();
  },

  async getTextFile(owner: string, repo: string, path: string, branch: string): Promise<SelectedFile> {
    const cacheKey = `${owner}/${repo}/${branch}/${path}`;
    if (textFileCache.has(cacheKey)) {
      return { path, type: 'text', content: textFileCache.get(cacheKey)! };
    }

    const res = await fetch(`/api/github/content?owner=${owner}&repo=${repo}&path=${path}&branch=${branch}`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error("Falha ao buscar arquivo");

    const text = await res.text();
    textFileCache.set(cacheKey, text);
    return { path, type: 'text', content: text };
  },

  async getPdfFile(owner: string, repo: string, path: string, branch: string): Promise<SelectedFile> {
    const cacheKey = `${owner}/${repo}/${branch}/${path}`;
    if (pdfFileCache.has(cacheKey)) {
      return { path, type: 'pdf', pdfBlobUrl: pdfFileCache.get(cacheKey)! };
    }

    const res = await fetch(`/api/github/content?owner=${owner}&repo=${repo}&path=${path}&branch=${branch}&format=pdf`, {
      headers: getAuthHeaders()
    });

    if (!res.ok) throw new Error("Falha ao buscar PDF");

    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    pdfFileCache.set(cacheKey, blobUrl);

    return { path, type: 'pdf', pdfBlobUrl: blobUrl };
  },

  clearCache() {
    textFileCache.clear();
    pdfFileCache.forEach((blobUrl) => URL.revokeObjectURL(blobUrl));
    pdfFileCache.clear();
  }
};
