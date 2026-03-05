import { NextRequest } from 'next/server';

export function getGithubHeaders(req: NextRequest) {
  const headers: Record<string, string> = {
    'User-Agent': 'Brada-Iota',
    Accept: 'application/vnd.github.v3+json',
  };

  const userToken = req.headers.get('x-github-token');
  if (userToken) headers.Authorization = `Bearer ${userToken}`;

  return headers;
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
