export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
}

export interface Snapshot {
  usage: TokenUsage;
  contextTokens: number;
  contextWindowTokens?: number;
  model?: string;
  sourceFile: string;
  capturedAt: Date;
}

export interface TranscriptFile {
  path: string;
  mtimeMs: number;
}
