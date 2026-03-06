import { PersonalFile } from '@/types';

interface PersonalContentResponseText {
  type: 'text';
  content: string;
  name: string;
}

interface PersonalContentResponsePdf {
  type: 'pdf';
  base64: string;
  name: string;
}

export type PersonalContentResponse = PersonalContentResponseText | PersonalContentResponsePdf;

const treeCache = new Map<string, PersonalFile[]>();
const fileCache = new Map<string, PersonalContentResponse>();

async function parseJsonResponse<T>(response: Response, fallbackError: string): Promise<T> {
  if (!response.ok) {
    let errorMessage = fallbackError;
    try {
      const errorBody = await response.json();
      if (errorBody.error) errorMessage = typeof errorBody.error === 'string' ? errorBody.error : JSON.stringify(errorBody.error);
    } catch {
      errorMessage = `${fallbackError} (${response.status} ${response.statusText})`;
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

function detectType(path: string): PersonalFile['type'] {
  const lowerPath = path.toLowerCase();
  if (lowerPath.endsWith('.pdf')) return 'pdf';
  if (lowerPath.endsWith('.md')) return 'md';
  return 'txt';
}

export const personalLibraryApi = {
  async getFiles(pat: string, owner: string, repo: string, branch: string): Promise<PersonalFile[]> {
    const cacheKey = `${owner}/${repo}/${branch}`;
    if (treeCache.has(cacheKey)) return treeCache.get(cacheKey)!;

    const query = new URLSearchParams({ owner, repo, branch });
    const response = await fetch(`/api/github/personal/tree?${query.toString()}`, {
      headers: { 'x-personal-pat': pat },
    });

    const data = await parseJsonResponse<{ files: Array<{ path: string; sha: string; size?: number }> }>(response, 'Falha ao listar arquivos do repositório pessoal');

    const files = data.files.map((file) => {
      const nameParts = file.path.split('/');
      return {
        path: file.path,
        name: nameParts[nameParts.length - 1],
        type: detectType(file.path),
        size: file.size,
        sha: file.sha,
      } satisfies PersonalFile;
    });

    treeCache.set(cacheKey, files);
    return files;
  },

  async getFileContent(pat: string, owner: string, repo: string, path: string, branch: string): Promise<PersonalContentResponse> {
    const cacheKey = `${owner}/${repo}/${branch}/${path}`;
    if (fileCache.has(cacheKey)) return fileCache.get(cacheKey)!;

    const query = new URLSearchParams({ owner, repo, path, branch });
    const response = await fetch(`/api/github/personal/content?${query.toString()}`, {
      headers: { 'x-personal-pat': pat },
    });

    const content = await parseJsonResponse<PersonalContentResponse>(response, 'Falha ao abrir arquivo do repositório pessoal');
    fileCache.set(cacheKey, content);
    return content;
  },

  clearCache() {
    treeCache.clear();
    fileCache.clear();
  },
};
