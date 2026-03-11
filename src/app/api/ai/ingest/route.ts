/**
 * src/app/api/ai/ingest/route.ts
 *
 * Rota de ingestão de documentos do repositório no SupabaseVectorStore.
 *
 * Chamada pelo frontend após o carregamento bem-sucedido do repositório.
 * Opera de forma assíncrona (fire-and-forget do ponto de vista do utilizador).
 *
 * Body: { files: { path, content }[], repoFullName: string, apiKey?: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { jsonError } from '@/app/api/_utils';
import { ingestRepoDocuments, isSupabaseConfigured } from '@/server/langchain.service';

export const runtime = 'nodejs';

// Timeout generoso — a ingestão pode demorar para repositórios grandes
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { skipped: true, reason: 'Supabase não configurado' },
        { status: 200 },
      );
    }

    const { files, repoFullName, apiKey } = await req.json();

    if (!repoFullName || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json(
        { error: 'repoFullName e files[] são obrigatórios' },
        { status: 400 },
      );
    }

    // Filtra apenas ficheiros .md e .txt (documentação de ensino)
    const docFiles = files.filter((f: { path: string; content: string }) =>
      /\.(md|txt)$/i.test(f.path) && f.content?.trim().length > 0,
    );

    if (docFiles.length === 0) {
      return NextResponse.json({ chunks: 0, message: 'Nenhum ficheiro .md/.txt para ingerir' });
    }

    const chunks = await ingestRepoDocuments(docFiles, repoFullName, apiKey);

    return NextResponse.json({
      chunks,
      files: docFiles.length,
      repo: repoFullName,
    });
  } catch (error) {
    return jsonError(error);
  }
}
