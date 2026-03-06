import { Article } from '@/types';

const fileCache = new Map<string, Article>();

async function parseResponse(response: Response) {
  if (!response.ok) {
    let errorMessage = response.statusText;
    try {
      const errorBody = await response.json();
      if (errorBody.error) errorMessage = typeof errorBody.error === 'string' ? errorBody.error : JSON.stringify(errorBody.error);
    } catch {}
    throw new Error(errorMessage);
  }
  return response.json();
}

export const articleApi = {
  async extractFromUrl(url: string): Promise<Article> {
    if (fileCache.has(url)) return fileCache.get(url)!;
    const response = await fetch('/api/article/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    const data = await parseResponse(response);
    fileCache.set(url, data.article);
    return data.article;
  },

  async extractFromText(text: string, title?: string): Promise<Article> {
    const response = await fetch('/api/article/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, title })
    });
    const data = await parseResponse(response);
    return data.article;
  },

  async extractFromPdf(file: File): Promise<Article> {
    const buffer = await file.arrayBuffer();
    const pdfBase64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));

    const response = await fetch('/api/article/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pdfBase64, title: file.name })
    });
    const data = await parseResponse(response);
    return data.article;
  },

  clearCache() {
    fileCache.clear();
  }
};
