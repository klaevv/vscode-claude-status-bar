import { Snapshot } from "./types";

export interface RenderedStatus {
  text: string;
  tooltip: string;
  percent: number;
  severity: "normal" | "warning" | "error";
}

function tokens(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
  return String(value);
}

export function renderStatus(snapshot: Snapshot, fallbackWindow: number): RenderedStatus {
  const limit = snapshot.contextWindowTokens || fallbackWindow;
  const percent = Math.max(0, snapshot.contextTokens / limit * 100);
  const rounded = Math.round(percent);
  const severity = percent >= 90 ? "error" : percent >= 75 ? "warning" : "normal";
  const age = snapshot.capturedAt.toLocaleString();
  const tooltip = [
    "### Claude Code context",
    "",
    `**${rounded}%** — ${tokens(snapshot.contextTokens)} / ${tokens(limit)} tokens`,
    snapshot.model ? `Model: \`${snapshot.model}\`` : undefined,
    `Input: ${snapshot.usage.inputTokens.toLocaleString()}`,
    `Cache read: ${snapshot.usage.cacheReadInputTokens.toLocaleString()}`,
    `Cache created: ${snapshot.usage.cacheCreationInputTokens.toLocaleString()}`,
    `Last turn: ${age}`,
    "",
    "$(info) Read locally from the newest Claude Code transcript. No network requests are made."
  ].filter(Boolean).join("  \n");
  return { text: `$(sparkle) Claude ${rounded}%`, tooltip, percent, severity };
}
