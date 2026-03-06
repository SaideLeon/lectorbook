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
  branch?: string;
}

export interface Article {
  id: string;
  title: string;
  url?: string;
  source?: string;
  authors?: string[];
  publishedAt?: string;
  abstract?: string;
  content: string;
  wordCount?: number;
  readingTimeMinutes?: number;
  tags?: string[];
  addedAt: number;
}

export interface ArticleLibraryResponse {
  articles: Article[];
  totalCount: number;
}

export interface AnalysisMessage {
  role: 'user' | 'model' | 'system';
  content: string;
  timestamp: number;
  isThinking?: boolean;
  relatedLinks?: { title: string; url: string }[];
}
