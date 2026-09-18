export function hashSourceContext(root: string): Promise<{
  digest: string;
  fileCount: number;
}>;

export function hashGitCommitSourceContext(root: string, sha: string): Promise<{
  digest: string;
  fileCount: number;
}>;