import { NextRequest, NextResponse } from 'next/server';
import { AppError, jsonError } from '@/app/api/_utils';
import { cacheService } from '@/server/cache.service';
import { isBinaryBuffer } from '@/server/github';

const PERSONAL_FILE_TTL_MS = 5 * 60 * 1000;
const PDF_SIZE_LIMIT_BYTES = 10 * 1024 * 1024;

export const runtime = 'nodejs';

function getPersonalGithubHeaders(req: NextRequest) {
  const pat = req.headers.get('x-personal-pat');
  if (!pat) throw new AppError('Missing Personal Access Token', 401);

  return {
    'User-Agent': 'Lectorbook',
    Accept: 'application/vnd.github.v3+json',
    Authorization: `Bearer ${pat}`,
  };
}

function getFileType(path: string): 'pdf' | 'text' {
  return path.toLowerCase().endsWith('.pdf') ? 'pdf' : 'text';
}

function getFileName(path: string) {
  const parts = path.split('/');
  return parts[parts.length - 1] || path;
}

export async function GET(req: NextRequest) {
  try {
    const owner = req.nextUrl.searchParams.get('owner');
    const repo = req.nextUrl.searchParams.get('repo');
    const filePath = req.nextUrl.searchParams.get('path');
    const branch = req.nextUrl.searchParams.get('branch');

    if (!owner || !repo || !filePath || !branch) throw new AppError('Missing required parameters', 400);

    const fileType = getFileType(filePath);
    const cachedContent = cacheService.getFileContent(owner, repo, branch, filePath, PERSONAL_FILE_TTL_MS);

    if (cachedContent) {
      if (fileType === 'pdf') {
        return NextResponse.json({ type: 'pdf', base64: cachedContent, name: getFileName(filePath) });
      }
      return NextResponse.json({ type: 'text', content: cachedContent, name: getFileName(filePath) });
    }

    const response = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`, {
      headers: getPersonalGithubHeaders(req),
    });

    if (!response.ok) {
      throw new AppError('Failed to fetch file content', response.status, {
        status: response.status,
        statusText: response.statusText,
        githubRequestId: response.headers.get('x-github-request-id') || undefined,
      });
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    if (fileType === 'pdf') {
      if (buffer.length > PDF_SIZE_LIMIT_BYTES) {
        throw new AppError('PDF exceeds the 10MB limit', 413);
      }

      const isLikelyBinary = isBinaryBuffer(buffer);
      const isPdfSignature = buffer.length > 4 && buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;
      if (!isLikelyBinary || !isPdfSignature) {
        throw new AppError('Invalid PDF file', 400);
      }

      const base64 = buffer.toString('base64');
      cacheService.setFileContent(owner, repo, branch, filePath, base64);
      return NextResponse.json({ type: 'pdf', base64, name: getFileName(filePath) });
    }

    if (isBinaryBuffer(buffer)) {
      throw new AppError('Binary files are not supported for analysis', 400);
    }

    const content = buffer.toString('utf-8');
    cacheService.setFileContent(owner, repo, branch, filePath, content);
    return NextResponse.json({ type: 'text', content, name: getFileName(filePath) });
  } catch (error) {
    return jsonError(error);
  }
}
