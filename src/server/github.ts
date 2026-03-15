import { NextRequest } from 'next/server';
import { AppError } from '@/app/api/_utils';

export function getGithubHeaders(req: NextRequest) {
  const headers: Record<string, string> = {
    'User-Agent': 'Lectorbook',
    Accept: 'application/vnd.github.v3+json',
  };

  const githubToken = process.env.GITHUB_TOKEN;
  if (githubToken) headers.Authorization = `Bearer ${githubToken}`;

  return headers;
}

export async function assertRepositoryIsInternal(req: NextRequest, owner: string, repo: string) {
  const headers = getGithubHeaders(req);
  const targetFullName = `${owner}/${repo}`.toLowerCase();
  const response = await fetch('https://api.github.com/user/repos?sort=updated&per_page=100&type=all', { headers });

  if (!response.ok) {
    throw new AppError('Failed to validate repository access', response.status, await response.json());
  }

  const repos = (await response.json()) as Array<{ full_name?: string }>;
  const isAllowed = repos.some((entry) => entry.full_name?.toLowerCase() === targetFullName);

  if (!isAllowed) {
    throw new AppError('Repository is not available in the authenticated account repositories list', 403);
  }
}

export function getAppUrl(req: NextRequest) {
  return process.env.APP_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
}

export function isBinaryBuffer(buffer: Buffer): boolean {
  if (buffer.length > 4 && buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) return true;
  if (buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04) return true;
  if (buffer.length > 4 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return true;
  if (buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return true;
  if (buffer.length > 4 && buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) return true;

  const checkLength = Math.min(buffer.length, 1024);
  for (let i = 0; i < checkLength; i++) {
    if (buffer[i] === 0) return true;
  }

  return false;
}
