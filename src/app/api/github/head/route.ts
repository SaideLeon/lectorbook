import { NextRequest, NextResponse } from 'next/server';
import { AppError, jsonError } from '@/app/api/_utils';
import { getGithubHeaders } from '@/server/github';
import { GithubRepoInfo } from '@/server/github.types';

export const runtime = 'nodejs';

interface GithubBranchResponse {
  commit: {
    sha: string;
  };
}

export async function GET(req: NextRequest) {
  try {
    const owner = req.nextUrl.searchParams.get('owner');
    const repo = req.nextUrl.searchParams.get('repo');
    const branch = req.nextUrl.searchParams.get('branch');

    if (!owner || !repo) throw new AppError('Owner and repo are required', 400);

    const headers = getGithubHeaders(req);
    let targetBranch = branch || '';

    if (!targetBranch) {
      const repoInfoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
      if (!repoInfoRes.ok) throw new AppError('Repository not found', 404);
      const repoInfo = (await repoInfoRes.json()) as GithubRepoInfo;
      targetBranch = repoInfo.default_branch;
    }

    const branchRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/branches/${targetBranch}`, { headers });

    if (!branchRes.ok) {
      throw new AppError('Failed to fetch repository branch info', branchRes.status, await branchRes.json());
    }

    const branchData = (await branchRes.json()) as GithubBranchResponse;

    return NextResponse.json({
      owner,
      repo,
      branch: targetBranch,
      headSha: branchData.commit.sha,
    });
  } catch (error) {
    return jsonError(error);
  }
}
