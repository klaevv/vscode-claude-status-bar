import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as readline from "node:readline";
import { Snapshot, TokenUsage, TranscriptFile } from "./types";

export function resolveClaudeHome(configured = "~/.claude"): string {
  if (configured === "~") return os.homedir();
  if (configured.startsWith(`~${path.sep}`) || configured.startsWith("~/")) {
    return path.join(os.homedir(), configured.slice(2));
  }
  return path.resolve(configured);
}

export async function listTranscriptFiles(home: string, lookbackDays: number, now = Date.now()): Promise<TranscriptFile[]> {
  const root = path.join(home, "projects");
  const cutoff = now - lookbackDays * 86_400_000;
  const found: TranscriptFile[] = [];
  const walk = async (directory: string): Promise<void> => {
    let entries: fs.Dirent[];
    try { entries = await fs.promises.readdir(directory, { withFileTypes: true }); } catch { return; }
    await Promise.all(entries.map(async (entry) => {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return walk(fullPath);
      if (!entry.isFile() || !entry.name.endsWith(".jsonl")) return;
      try {
        const stat = await fs.promises.stat(fullPath);
        if (stat.mtimeMs >= cutoff) found.push({ path: fullPath, mtimeMs: stat.mtimeMs });
      } catch { /* File may disappear during a scan. */ }
    }));
  };
  await walk(root);
  return found.sort((a, b) => b.mtimeMs - a.mtimeMs);
}

function finite(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}

export async function lastUsageInFile(filePath: string): Promise<Snapshot | undefined> {
  let latest: Snapshot | undefined;
  let input: fs.ReadStream;
  try { input = fs.createReadStream(filePath, { encoding: "utf8" }); } catch { return undefined; }
  input.on("error", () => undefined);
  try {
    const lines = readline.createInterface({ input, crlfDelay: Infinity });
    for await (const line of lines) {
      try {
        const event = JSON.parse(line) as Record<string, any>;
        if (event.type !== "assistant" || !event.message?.usage) continue;
        const timestamp = new Date(event.timestamp);
        if (Number.isNaN(timestamp.valueOf())) continue;
        const raw = event.message.usage;
        const usage: TokenUsage = {
          inputTokens: finite(raw.input_tokens),
          outputTokens: finite(raw.output_tokens),
          cacheCreationInputTokens: finite(raw.cache_creation_input_tokens),
          cacheReadInputTokens: finite(raw.cache_read_input_tokens)
        };
        // Claude's input/cache values describe the active context for that turn.
        const contextTokens = usage.inputTokens + usage.cacheCreationInputTokens + usage.cacheReadInputTokens;
        const candidate: Snapshot = {
          usage, contextTokens, sourceFile: filePath, capturedAt: timestamp,
          model: typeof event.message.model === "string" ? event.message.model : undefined,
          contextWindowTokens: finite(event.message.context_window) || undefined
        };
        if (!latest || candidate.capturedAt > latest.capturedAt) latest = candidate;
      } catch { /* Ignore malformed and partial JSONL lines. */ }
    }
  } catch { return latest; }
  return latest;
}

export async function readLatestSnapshot(home: string, lookbackDays: number): Promise<Snapshot | undefined> {
  const files = await listTranscriptFiles(home, lookbackDays);
  let latest: Snapshot | undefined;
  for (const file of files) {
    if (latest && file.mtimeMs < latest.capturedAt.valueOf()) break;
    const candidate = await lastUsageInFile(file.path);
    if (candidate && (!latest || candidate.capturedAt > latest.capturedAt)) latest = candidate;
  }
  return latest;
}
