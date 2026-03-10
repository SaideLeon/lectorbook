export interface Chunk {
  text: string;
  path: string;
  index: number;
  totalChunks: number;
}

const DEFAULT_MAX_TOKENS = 500;
const DEFAULT_OVERLAP = 50;
const MIN_CHUNK_TOKENS = 50;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function splitLargePart(text: string, maxTokens: number): string[] {
  if (estimateTokens(text) <= maxTokens) return [text];

  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (sentences.length <= 1) {
    const words = text.split(/\s+/).filter(Boolean);
    const wordChunkSize = Math.max(1, Math.floor(maxTokens * 4 / 6));
    const chunks: string[] = [];
    for (let i = 0; i < words.length; i += wordChunkSize) {
      chunks.push(words.slice(i, i + wordChunkSize).join(' '));
    }
    return chunks;
  }

  const result: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    const candidate = current ? `${current} ${sentence}` : sentence;
    if (estimateTokens(candidate) <= maxTokens) {
      current = candidate;
      continue;
    }

    if (current) {
      result.push(current);
      current = sentence;
      continue;
    }

    const words = sentence.split(/\s+/).filter(Boolean);
    const wordChunkSize = Math.max(1, Math.floor(maxTokens * 4 / 6));
    for (let i = 0; i < words.length; i += wordChunkSize) {
      result.push(words.slice(i, i + wordChunkSize).join(' '));
    }
  }

  if (current) result.push(current);
  return result;
}

export function chunkDocument(
  content: string,
  path: string,
  options?: { maxTokens?: number; overlap?: number },
): Chunk[] {
  const maxTokens = options?.maxTokens ?? DEFAULT_MAX_TOKENS;
  const overlap = options?.overlap ?? DEFAULT_OVERLAP;
  const trimmed = content.trim();

  if (!trimmed) return [];

  if (estimateTokens(trimmed) <= maxTokens) {
    return [{ text: trimmed, path, index: 0, totalChunks: 1 }];
  }

  const paragraphs = trimmed
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .flatMap((p) => splitLargePart(p, maxTokens));

  const chunks: string[] = [];
  let currentParts: string[] = [];
  let currentTokens = 0;

  for (const part of paragraphs) {
    const partTokens = estimateTokens(part);
    if (currentTokens + partTokens <= maxTokens || currentParts.length === 0) {
      currentParts.push(part);
      currentTokens += partTokens;
      continue;
    }

    const completed = currentParts.join('\n\n').trim();
    if (estimateTokens(completed) >= MIN_CHUNK_TOKENS || chunks.length === 0) {
      chunks.push(completed);
    }

    const carry: string[] = [];
    let carryTokens = 0;
    for (let i = currentParts.length - 1; i >= 0; i--) {
      const t = estimateTokens(currentParts[i]);
      if (carryTokens + t > overlap) break;
      carry.unshift(currentParts[i]);
      carryTokens += t;
    }

    currentParts = [...carry, part];
    currentTokens = carryTokens + partTokens;
  }

  if (currentParts.length > 0) {
    const finalChunk = currentParts.join('\n\n').trim();
    if (estimateTokens(finalChunk) >= MIN_CHUNK_TOKENS || chunks.length === 0) {
      chunks.push(finalChunk);
    }
  }

  const totalChunks = chunks.length;
  return chunks.map((text, index) => ({ text, path, index, totalChunks }));
}
