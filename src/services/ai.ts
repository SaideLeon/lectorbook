export async function analyzeArticle(
  content: string,
  metadata?: Record<string, unknown>,
  apiKey?: string
) {
  const response = await fetch('/api/ai/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, metadata, apiKey })
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `AI Analysis failed: ${response.statusText}`);
  }

  return response.json();
}

export async function thinkAndSuggest(
  history: { role: string; content: string }[],
  currentInput: string,
  context: string,
  apiKey?: string
) {
  const response = await fetch('/api/ai/think', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ history, currentInput, context, apiKey })
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `AI Thinking failed: ${response.statusText}`);
  }

  return response.json();
}

export async function generateArticleReport(
  article: { title?: string; content: string },
  analysis: string,
  apiKey?: string
) {
  const response = await fetch('/api/ai/report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ article, analysis, apiKey })
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Report generation failed: ${response.statusText}`);
  }

  return response.json();
}
