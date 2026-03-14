export interface FileNode {
  path: string;
  mode: string;
  type: 'blob' | 'tree';
  sha: string;
  size?: number;
  url: string;
}

export interface RepoTreeResponse {
  sha: string;
  url: string;
  tree: FileNode[];
  truncated: boolean;
  headSha?: string;
  branch?: string;
  owner?: string;
  repo?: string;
  fullName?: string;
  description?: string | null;
}

export interface AnalysisMessage {
  role: 'user' | 'model' | 'system';
  content: string;
  timestamp: number;
  isThinking?: boolean;
  isSystemNotice?: boolean;
  relatedLinks?: { title: string; url: string }[];
}

export interface RepositoryFile {
  path: string;
  content: string;
  rawUrl?: string;
}

// ─── Quiz ────────────────────────────────────────────────────────────────────

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  source: string;
}

export type QuizState = 'idle' | 'loading' | 'active' | 'finished';
