import { pipeline, type Pipeline } from '@xenova/transformers';

type Embedder = Awaited<ReturnType<typeof pipeline>>;

let _embedder: Embedder | null = null;
let _loading: Promise<Embedder> | null = null;

export async function getEmbedder(): Promise<Embedder> {
  if (_embedder) return _embedder;
  if (_loading) return _loading;

  _loading = pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
    quantized: true,
  }).then((p) => {
    _embedder = p;
    _loading = null;
    return p;
  });

  return _loading;
}

export async function embed(text: string): Promise<number[]> {
  const embedder = await getEmbedder();
  const output = await embedder(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data as Float32Array);
}
