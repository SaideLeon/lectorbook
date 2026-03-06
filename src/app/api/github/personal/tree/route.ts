import { NextRequest, NextResponse } from 'next/server';
import { AppError, jsonError } from '@/app/api/_utils';
import { cacheService } from '@/server/cache.service';
import { extractGithubErrorDetails } from '@/server/github';
import { GithubRepoInfo, GithubTreeResponse } from '@/server/github.types';

const PERSONAL_TREE_TTL_MS = 5 * 60 * 1000;
const SUPPORTED_EXTENSIONS = ['.pdf', '.md', '.txt'];

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

function isSupportedDocument(path: string) {
  const lowerPath = path.toLowerCase();
  return SUPPORTED_EXTENSIONS.some((extension) => lowerPath.endsWith(extension));
}

export async function GET(req: NextRequest) {
  try {
    const owner = req.nextUrl.searchParams.get('owner');
    const repo = req.nextUrl.searchParams.get('repo');
    const branch = req.nextUrl.searchParams.get('branch');

    if (!owner || !repo) throw new AppError('Owner and repo are required', 400);

    const headers = getPersonalGithubHeaders(req);
    let targetBranch = branch || '';

    if (!targetBranch) {
      const repoInfoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
      if (!repoInfoRes.ok) {
        throw new AppError('Repository not found', repoInfoRes.status, await extractGithubErrorDetails(repoInfoRes));
      }
      const repoInfo = (await repoInfoRes.json()) as GithubRepoInfo;
      targetBranch = repoInfo.default_branch;
    }

    const cachedTree = cacheService.getTree(owner, repo, targetBranch, PERSONAL_TREE_TTL_MS);
    if (cachedTree) return NextResponse.json(cachedTree);

    const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${targetBranch}?recursive=1`, { headers });
    if (!treeRes.ok) {
      throw new AppError('Failed to fetch repository tree', treeRes.status, await extractGithubErrorDetails(treeRes));
    }

    const treeData = (await treeRes.json()) as GithubTreeResponse;
    const files = treeData.tree.filter((entry) => entry.type === 'blob' && isSupportedDocument(entry.path));
    const result = { owner, repo, branch: targetBranch, files };

    cacheService.setTree(owner, repo, targetBranch, result);
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
