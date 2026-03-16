type ContextFile = { path: string; content: string };

type Chunk = {
  id: string;
  path: string;
  text: string;
  lexicalScore: number;
};

const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 180;

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function tokenize(text: string): string[] {
  return normalize(text)
    .split(/[^a-z0-9_]+/)
    .filter((t) => t.length > 2);
}

function splitIntoChunks(content: string): string[] {
  const safe = content.replace(/\r\n/g, '\n');
  const chunks: string[] = [];
  let start = 0;

  while (start < safe.length) {
    const end = Math.min(start + CHUNK_SIZE, safe.length);
    chunks.push(safe.slice(start, end));
    if (end >= safe.length) break;
    start = Math.max(0, end - CHUNK_OVERLAP);
  }

  return chunks;
}

function lexicalScore(query: string, text: string): number {
  const qTokens = tokenize(query);
  if (!qTokens.length) return 0;

  const source = normalize(text);
  let hits = 0;
  for (const token of qTokens) {
    if (source.includes(token)) hits += 1;
  }

  const tokenCoverage = hits / qTokens.length;
  const phraseBoost = source.includes(normalize(query).trim()) ? 0.25 : 0;
  return Math.min(1, tokenCoverage + phraseBoost);
}

export function createSearchQuery(currentInput: string, history: Array<{ role: string; content: string }> = []): string {
  const lastUserTurns = history
    .filter((h) => h.role === 'user')
    .slice(-2)
    .map((h) => h.content);

  return [...lastUserTurns, currentInput].filter(Boolean).join('\n');
}

export async function buildRelevantContext(options: {
  query: string;
  contextFiles: ContextFile[];
  apiKey?: string;
  maxChunks?: number;
}) {
  const { query, contextFiles, maxChunks = 8 } = options;
  void options.apiKey;

  const chunks: Chunk[] = [];
  for (const file of contextFiles || []) {
    const parts = splitIntoChunks(file.content || '');
    parts.forEach((part, idx) => {
      const score = lexicalScore(query, part);
      chunks.push({
        id: `${file.path}#${idx}`,
        path: file.path,
        text: part,
        lexicalScore: score,
      });
    });
  }

  if (!chunks.length) {
    return { selectedChunks: [], renderedContext: 'Nenhum arquivo selecionado para contexto.', warnings: [] as string[] };
  }

  const selectedChunks = chunks
    .sort((a, b) => b.lexicalScore - a.lexicalScore)
    .slice(0, maxChunks)
    .filter((c) => c.lexicalScore > 0.02);

  const grouped = new Map<string, string[]>();
  for (const chunk of selectedChunks) {
    if (!grouped.has(chunk.path)) grouped.set(chunk.path, []);
    grouped.get(chunk.path)!.push(chunk.text.trim());
  }

  const renderedContext =
    selectedChunks.length > 0
      ? Array.from(grouped.entries())
          .map(([path, excerpts]) => `--- ${path} ---\n${excerpts.join('\n\n[...]\n\n')}`)
          .join('\n\n')
      : 'Nenhum trecho relevante encontrado para a pergunta.';

  return { selectedChunks, renderedContext, warnings: [] as string[] };
}
