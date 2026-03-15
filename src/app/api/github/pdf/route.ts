import { NextRequest, NextResponse } from 'next/server';
import { AppError, jsonError } from '@/app/api/_utils';
import { getGithubHeaders, assertRepositoryIsInternal } from '@/server/github';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const owner = req.nextUrl.searchParams.get('owner');
    const repo = req.nextUrl.searchParams.get('repo');
    const filePath = req.nextUrl.searchParams.get('path');
    const branch = req.nextUrl.searchParams.get('branch');

    if (!owner || !repo || !filePath || !branch) {
      throw new AppError('Missing required parameters', 400);
    }

    await assertRepositoryIsInternal(req, owner, repo);

    if (!/\.pdf$/i.test(filePath)) {
      throw new AppError('Only PDF files are supported on this endpoint', 400);
    }

    const encodedPath = filePath.split('/').map((segment) => encodeURIComponent(segment)).join('/');
    const githubRawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${encodedPath}`;
    const response = await fetch(githubRawUrl, { headers: getGithubHeaders(req) });

    if (!response.ok) {
      throw new AppError('Failed to fetch PDF file', response.status);
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${encodeURIComponent(filePath.split('/').pop() || 'document.pdf')}"`,
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
