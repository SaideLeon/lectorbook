import { NextRequest, NextResponse } from 'next/server';
import { AppError, jsonError } from '@/app/api/_utils';
import { extractGithubErrorDetails } from '@/server/github';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const userToken = req.headers.get('x-github-token');
    if (!userToken) {
      throw new AppError('GitHub token is required to list repositories', 401, {
        reason: 'missing_header',
        header: 'x-github-token',
      });
    }

    const response = await fetch('https://api.github.com/user/repos?sort=updated&per_page=100&type=all', {
      headers: {
        'User-Agent': 'Brada-Iota',
        Accept: 'application/vnd.github.v3+json',
        Authorization: `Bearer ${userToken}`,
      },
    });

    if (!response.ok) {
      throw new AppError('Failed to fetch repositories', response.status, await extractGithubErrorDetails(response));
    }

    return NextResponse.json(await response.json());
  } catch (error) {
    return jsonError(error);
  }
}
