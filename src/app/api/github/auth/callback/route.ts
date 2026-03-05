import { NextRequest, NextResponse } from 'next/server';
import { AppError, jsonError } from '@/app/api/_utils';
import { extractGithubErrorDetails, getAppUrl } from '@/server/github';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get('code');
    const githubClientId = process.env.GITHUB_CLIENT_ID;
    const githubClientSecret = process.env.GITHUB_CLIENT_SECRET;

    if (!code) throw new AppError('No code provided', 400, { queryParam: 'code' });

    if (!githubClientId || !githubClientSecret) {
      throw new AppError('GitHub OAuth not configured', 500, {
        missingEnvVars: [
          !githubClientId ? 'GITHUB_CLIENT_ID' : null,
          !githubClientSecret ? 'GITHUB_CLIENT_SECRET' : null,
        ].filter(Boolean),
        hasAppUrl: Boolean(process.env.APP_URL),
      });
    }

    const redirectUri = `${getAppUrl(req)}/api/github/auth/callback`;

    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ client_id: githubClientId, client_secret: githubClientSecret, code, redirect_uri: redirectUri }),
    });

    if (!tokenRes.ok) {
      throw new AppError('GitHub OAuth token exchange failed', tokenRes.status, await extractGithubErrorDetails(tokenRes));
    }

    const tokenData = await tokenRes.json();
    if (tokenData.error) {
      throw new AppError(tokenData.error_description || tokenData.error, 400, {
        githubError: tokenData,
      });
    }

    const html = `
      <html><body>
        <script>
          if (window.opener) {
            window.opener.postMessage({ type: 'GITHUB_AUTH_SUCCESS', token: '${tokenData.access_token}' }, '*');
            window.close();
          } else {
            window.location.href = '/';
          }
        </script>
        <p>Autenticação concluída! Esta janela fechará automaticamente.</p>
      </body></html>
    `;

    return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  } catch (error) {
    return jsonError(error);
  }
}
