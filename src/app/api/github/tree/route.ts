import { NextRequest, NextResponse } from 'next/server';
import { AppError, jsonError } from '@/app/api/_utils';
import { cacheService } from '@/server/cache.service';
import { getGithubHeaders } from '@/server/github';
import { GithubRepoInfo, GithubTreeResponse } from '@/server/github.types';

interface GithubBranchResponse {
  name: string;
  commit: {
    sha: string;
  };
}

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const owner = req.nextUrl.searchParams.get('owner');
    const repo = req.nextUrl.searchParams.get('repo');
    const branch = req.nextUrl.searchParams.get('branch');

    if (!owner || !repo) throw new AppError('Owner and repo are required', 400);

    const headers = getGithubHeaders(req);
    let targetBranch = branch || '';
    let repoDescription: string | null = null;

    const repoInfoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
    if (!repoInfoRes.ok) throw new AppError('Repository not found', 404);
    const repoInfo = (await repoInfoRes.json()) as GithubRepoInfo;

    if (!targetBranch) {
      targetBranch = repoInfo.default_branch;
    }
    repoDescription = repoInfo.description;

    const cachedTreeEntry = cacheService.getTreeEntry(owner, repo, targetBranch);

    const branchHeaders = getGithubHeaders(req);
    if (cachedTreeEntry?.etag) {
      branchHeaders['If-None-Match'] = cachedTreeEntry.etag;
    }
    if (cachedTreeEntry?.lastModified) {
      branchHeaders['If-Modified-Since'] = cachedTreeEntry.lastModified;
    }

    const branchRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/branches/${targetBranch}`, {
      headers: branchHeaders,
    });

    if (branchRes.status === 304 && cachedTreeEntry) {
      return NextResponse.json(cachedTreeEntry.data);
    }

    if (!branchRes.ok) {
      throw new AppError('Failed to fetch repository branch info', branchRes.status, await branchRes.json());
    }

    const branchData = (await branchRes.json()) as GithubBranchResponse;
    const latestHeadSha = branchData.commit.sha;
    const branchEtag = branchRes.headers.get('etag') ?? undefined;
    const branchLastModified = branchRes.headers.get('last-modified') ?? undefined;

    if (cachedTreeEntry && cachedTreeEntry.headSha === latestHeadSha) {
      cacheService.setTree(owner, repo, targetBranch, cachedTreeEntry.data, {
        headSha: latestHeadSha,
        etag: branchEtag,
        lastModified: branchLastModified,
      });
      return NextResponse.json(cachedTreeEntry.data);
    }

    cacheService.invalidateRepositoryBranch(owner, repo, targetBranch);

    const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${targetBranch}?recursive=1`, { headers });
    if (!treeRes.ok) {
      throw new AppError('Failed to fetch repository tree', treeRes.status, await treeRes.json());
    }

    const treeData = (await treeRes.json()) as GithubTreeResponse;
    const result = {
      owner,
      repo,
      fullName: repoInfo.full_name,
      description: repoDescription,
      branch: targetBranch,
      headSha: latestHeadSha,
      tree: treeData.tree,
    };
    cacheService.setTree(owner, repo, targetBranch, result, {
      headSha: latestHeadSha,
      etag: branchEtag,
      lastModified: branchLastModified,
    });

    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
