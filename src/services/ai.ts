export async function analyzeCode(
  files: { path: string; content: string }[],
  userQuery?: string,
  apiKey?: string
) {
  const response = await fetch('/api/ai/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contextFiles: files,
      prompt: userQuery,
      apiKey
    })
  });

  if (!response.ok) {
    let errorMessage = response.statusText;
    try {
      const errorBody = await response.json();
      if (errorBody.error) errorMessage = typeof errorBody.error === 'string' ? errorBody.error : JSON.stringify(errorBody.error);
    } catch (e) {
      // Ignore JSON parse error
    }
    throw new Error(`AI Analysis failed: ${errorMessage}`);
  }

  return response.json();
}

export async function thinkAndSuggest(
  history: { role: string; content: string }[],
  currentInput: string,
  context: string,
  contextFiles: { path: string; content: string }[] = [],
  apiKey?: string
) {
  const response = await fetch('/api/ai/think', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      history,
      currentInput,
      context,
      contextFiles,
      apiKey
    })
  });

  if (!response.ok) {
    let errorMessage = response.statusText;
    try {
      const errorBody = await response.json();
      if (errorBody.error) errorMessage = typeof errorBody.error === 'string' ? errorBody.error : JSON.stringify(errorBody.error);
    } catch (e) {
      // Ignore JSON parse error
    }
    throw new Error(`AI Thinking failed: ${errorMessage}`);
  }

  return response.json();
}

export async function generateReadingSheet(
  files: { path: string; content: string }[],
  context: string,
  apiKey?: string
) {
  const response = await fetch('/api/ai/blueprint', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contextFiles: files,
      context,
      apiKey
    })
  });

  if (!response.ok) {
    let errorMessage = response.statusText;
    try {
      const errorBody = await response.json();
      if (errorBody.error) errorMessage = typeof errorBody.error === 'string' ? errorBody.error : JSON.stringify(errorBody.error);
    } catch (e) {
      // Ignore JSON parse error
    }
    throw new Error(`Reading sheet generation failed: ${errorMessage}`);
  }

  return response.json();
}

export async function transcribeAudio(file: File) {
  const formData = new FormData();
  formData.append('audio', file);

  const response = await fetch('/api/ai/transcribe', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    let errorMessage = response.statusText;
    try {
      const errorBody = await response.json();
      if (errorBody.error) {
        errorMessage = typeof errorBody.error === 'string' ? errorBody.error : JSON.stringify(errorBody.error);
      }
    } catch {
      // Ignore JSON parse error
    }

    throw new Error(`Falha na transcrição de áudio: ${errorMessage}`);
  }

  const data = await response.json();
  return data.text as string;
}

type StreamEvent =
  | { type: 'chunk'; text: string }
  | { type: 'done'; relatedLinks?: { title: string; url: string }[] }
  | { type: 'error'; message: string };

export async function thinkAndSuggestStream(
  history: { role: string; content: string }[],
  currentInput: string,
  context: string,
  contextFiles: { path: string; content: string }[] = [],
  callbacks: {
    onChunk: (text: string) => void;
    onDone?: (relatedLinks: { title: string; url: string }[]) => void;
  },
  apiKey?: string
) {
  const response = await fetch('/api/ai/think', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      history,
      currentInput,
      context,
      contextFiles,
      apiKey,
    }),
  });

  if (!response.ok) {
    let errorMessage = response.statusText;
    try {
      const errorBody = await response.json();
      if (errorBody.error) {
        errorMessage = typeof errorBody.error === 'string' ? errorBody.error : JSON.stringify(errorBody.error);
      }
    } catch {
      // Ignore JSON parse error
    }
    throw new Error(`AI Thinking failed: ${errorMessage}`);
  }

  if (!response.body) {
    throw new Error('Resposta da IA sem stream disponível.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;

      const event = JSON.parse(line) as StreamEvent;

      if (event.type === 'chunk') {
        callbacks.onChunk(event.text || '');
        continue;
      }

      if (event.type === 'done') {
        callbacks.onDone?.(event.relatedLinks || []);
        continue;
      }

      if (event.type === 'error') {
        throw new Error(event.message || 'Erro desconhecido no streaming da IA.');
      }
    }
  }

  if (buffer.trim()) {
    const event = JSON.parse(buffer) as StreamEvent;
    if (event.type === 'chunk') callbacks.onChunk(event.text || '');
    if (event.type === 'done') callbacks.onDone?.(event.relatedLinks || []);
    if (event.type === 'error') throw new Error(event.message || 'Erro desconhecido no streaming da IA.');
  }
}
