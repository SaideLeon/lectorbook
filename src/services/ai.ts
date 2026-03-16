// src/services/ai.ts

export async function analyzeCode(
  files: { path: string; content: string }[],
  userQuery?: string,
  apiKey?: string,
) {
  const response = await fetch('/api/ai/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contextFiles: files, prompt: userQuery, apiKey }),
  });

  if (!response.ok) {
    let errorMessage = response.statusText;
    try {
      const errorBody = await response.json();
      if (errorBody.error) errorMessage = typeof errorBody.error === 'string' ? errorBody.error : JSON.stringify(errorBody.error);
    } catch { /* Ignore */ }
    throw new Error(`AI Analysis failed: ${errorMessage}`);
  }

  return response.json();
}

/**
 * Ingere os ficheiros do repositório no Supabase Vector Store.
 * Chamada de forma assíncrona (fire-and-forget) após o carregamento do repositório.
 *
 * Se o Supabase não estiver configurado, o servidor retorna { skipped: true }
 * sem erro — o frontend não precisa tratar.
 */
export async function ingestDocuments(
  files: { path: string; content: string }[],
  repoFullName: string,
  apiKey?: string,
): Promise<{ chunks: number; skipped?: boolean }> {
  const response = await fetch('/api/ai/ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files, repoFullName, apiKey }),
  });

  if (!response.ok) {
    let errorMessage = response.statusText;
    try {
      const errorBody = await response.json();
      if (errorBody.error) errorMessage = typeof errorBody.error === 'string' ? errorBody.error : JSON.stringify(errorBody.error);
    } catch { /* Ignore */ }
    throw new Error(`Ingestão falhou: ${errorMessage}`);
  }

  return response.json();
}

export async function generateReadingSheet(
  files: { path: string; content: string }[],
  context: string,
  apiKey?: string,
) {
  const response = await fetch('/api/ai/blueprint', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contextFiles: files, context, apiKey }),
  });

  if (!response.ok) {
    let errorMessage = response.statusText;
    try {
      const errorBody = await response.json();
      if (errorBody.error) errorMessage = typeof errorBody.error === 'string' ? errorBody.error : JSON.stringify(errorBody.error);
    } catch { /* Ignore */ }
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
      if (errorBody.error) errorMessage = typeof errorBody.error === 'string' ? errorBody.error : JSON.stringify(errorBody.error);
    } catch { /* Ignore */ }
    throw new Error(`Falha na transcrição de áudio: ${errorMessage}`);
  }

  const data = await response.json();
  return data.text as string;
}

export async function synthesizeTextToSpeech(text: string, apiKey?: string) {
  const response = await fetch('/api/ai/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, apiKey }),
  });

  if (!response.ok) {
    let errorMessage = response.statusText;
    try {
      const errorBody = await response.json();
      if (errorBody.error) errorMessage = typeof errorBody.error === 'string' ? errorBody.error : JSON.stringify(errorBody.error);
    } catch { /* Ignore */ }
    throw new Error(`Falha na síntese de áudio: ${errorMessage}`);
  }

  return response.json() as Promise<{ audioBase64: string; mimeType: string }>;
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
    onError?: (message: string, error?: unknown) => void;
  },
  apiKey?: string,
  sessionId?: string,       // <-- novo: UUID de sessão para persistência
  repoFullName?: string,    // <-- novo: "usuario/repo" para filtro no Supabase
) {
  const notifyCallbackError = (message: string, error?: unknown) => {
    callbacks.onError?.(message, error);
  };

  const response = await fetch('/api/ai/think', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      history,
      currentInput,
      context,
      contextFiles,
      apiKey,
      sessionId,
      repoFullName,
    }),
  });

  if (!response.ok) {
    let errorMessage = response.statusText;
    try {
      const errorBody = await response.json();
      if (errorBody.error) errorMessage = typeof errorBody.error === 'string' ? errorBody.error : JSON.stringify(errorBody.error);
    } catch { /* Ignore */ }
    throw new Error(`AI Thinking failed: ${errorMessage}`);
  }

  if (!response.body) {
    throw new Error('Resposta da IA sem stream disponível.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    let chunkResult: ReadableStreamReadResult<Uint8Array>;
    try {
      chunkResult = await reader.read();
    } catch (error) {
      notifyCallbackError('Falha ao ler dados do stream da IA.', error);
      throw error;
    }

    const { done, value } = chunkResult;
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;
      let event: StreamEvent;
      try {
        event = JSON.parse(line) as StreamEvent;
      } catch (error) {
        notifyCallbackError('Falha ao interpretar um evento de stream da IA.', error);
        throw error;
      }

      if (event.type === 'chunk') {
        try {
          callbacks.onChunk(event.text || '');
        } catch (error) {
          notifyCallbackError('Erro no callback onChunk durante o streaming.', error);
          throw error;
        }
        continue;
      }
      if (event.type === 'done') {
        try {
          callbacks.onDone?.(event.relatedLinks || []);
        } catch (error) {
          notifyCallbackError('Erro no callback onDone ao finalizar o streaming.', error);
          throw error;
        }
        continue;
      }
      if (event.type === 'error') throw new Error(event.message || 'Erro desconhecido no streaming da IA.');
    }
  }

  if (buffer.trim()) {
    let event: StreamEvent;
    try {
      event = JSON.parse(buffer) as StreamEvent;
    } catch (error) {
      notifyCallbackError('Falha ao interpretar o evento final do stream da IA.', error);
      throw error;
    }

    if (event.type === 'chunk') {
      try {
        callbacks.onChunk(event.text || '');
      } catch (error) {
        notifyCallbackError('Erro no callback onChunk ao processar o evento final.', error);
        throw error;
      }
    }
    if (event.type === 'done') {
      try {
        callbacks.onDone?.(event.relatedLinks || []);
      } catch (error) {
        notifyCallbackError('Erro no callback onDone ao processar o evento final.', error);
        throw error;
      }
    }
    if (event.type === 'error') throw new Error(event.message || 'Erro desconhecido no streaming da IA.');
  }
}
