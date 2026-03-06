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

export interface AnalysisMessage {
  role: 'user' | 'model' | 'system';
  content: string;
  timestamp: number;
  isThinking?: boolean;
  relatedLinks?: { title: string; url: string }[];
}

export interface SelectedFile {
  path: string;
  type: 'text' | 'pdf';
  content?: string;
  pdfBlobUrl?: string;
}
