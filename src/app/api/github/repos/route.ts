import { NextResponse } from 'next/server';
import { AppError, jsonError } from '@/app/api/_utils';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) throw new AppError('GitHub token is not configured in server environment', 500);

    const response = await fetch('https://api.github.com/user/repos?sort=updated&per_page=100&type=all', {
      headers: {
        'User-Agent': 'Lectorbook',
        Accept: 'application/vnd.github.v3+json',
        Authorization: `Bearer ${githubToken}`,
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
