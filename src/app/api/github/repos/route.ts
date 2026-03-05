import { NextRequest, NextResponse } from 'next/server';
import { AppError, jsonError } from '@/app/api/_utils';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const userToken = req.headers.get('x-github-token');
    if (!userToken) throw new AppError('GitHub token is required to list repositories', 401);

    const response = await fetch('https://api.github.com/user/repos?sort=updated&per_page=100&type=all', {
      headers: {
        'User-Agent': 'Brada-Iota',
        Accept: 'application/vnd.github.v3+json',
        Authorization: `Bearer ${userToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new AppError('Failed to fetch repositories', response.status, error);
    }

    return NextResponse.json(await response.json());
  } catch (error) {
    return jsonError(error);
  }
}
