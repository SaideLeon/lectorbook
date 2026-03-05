import { NextRequest, NextResponse } from 'next/server';
import { AppError, jsonError } from '@/app/api/_utils';
import { getAppUrl } from '@/server/github';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const githubClientId = process.env.GITHUB_CLIENT_ID;
    if (!githubClientId) throw new AppError('GitHub OAuth is not configured', 500);

    const redirectUri = `${getAppUrl(req)}/api/github/auth/callback`;
    const params = new URLSearchParams({
      client_id: githubClientId,
      redirect_uri: redirectUri,
      scope: 'repo,user',
      state: Math.random().toString(36).substring(7),
    });

    return NextResponse.json({ url: `https://github.com/login/oauth/authorize?${params.toString()}` });
  } catch (error) {
    return jsonError(error);
  }
}
