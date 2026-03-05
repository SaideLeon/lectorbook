import { NextRequest, NextResponse } from 'next/server';
import { AppError, jsonError } from '@/app/api/_utils';
import { cacheService } from '@/server/cache.service';
import { getGithubHeaders, isBinaryBuffer } from '@/server/github';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const owner = req.nextUrl.searchParams.get('owner');
    const repo = req.nextUrl.searchParams.get('repo');
    const filePath = req.nextUrl.searchParams.get('path');
    const branch = req.nextUrl.searchParams.get('branch');

    if (!owner || !repo || !filePath || !branch) throw new AppError('Missing required parameters', 400);

    const cachedContent = cacheService.getFileContent(owner, repo, branch, filePath);
    if (cachedContent) return new NextResponse(cachedContent);

    const response = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`, {
      headers: getGithubHeaders(req),
    });

    if (!response.ok) throw new AppError('Failed to fetch file content', response.status);

    const buffer = Buffer.from(await response.arrayBuffer());
    if (isBinaryBuffer(buffer)) {
      return new NextResponse('Binary files are not supported for analysis', { status: 400 });
    }

    const content = buffer.toString('utf-8');
    cacheService.setFileContent(owner, repo, branch, filePath, content);
    return new NextResponse(content);
  } catch (error) {
    return jsonError(error);
  }
}
