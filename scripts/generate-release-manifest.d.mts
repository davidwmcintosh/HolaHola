export interface GeneratedReleaseManifest {
  schemaVersion: 1;
  authority: 'build' | 'development';
  promotable: boolean;
  commitSha: string | null;
  commitSource: string;
  sourceContextSha256: string;
  sourceContextAlgorithm: string;
  sourceFileCount: number;
  dirtyWorktree: boolean | null;
}

export function generateReleaseManifest(options?: {
  root?: string;
  output?: string;
  env?: Record<string, string | undefined>;
}): Promise<GeneratedReleaseManifest>;