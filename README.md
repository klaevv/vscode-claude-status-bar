# Claude Status Bar

A minimal VS Code extension that shows the **current Claude Code context-window usage** in the status bar. It is local-only: the extension reads Claude Code JSONL transcripts under `~/.claude/projects` and never makes a network request, reads credentials, or invokes Claude.

> Claude Code transcripts do not currently expose subscription rate-limit windows or reset times. This extension therefore reports the latest conversation's context usage—not account quota—and labels it accordingly rather than silently calling a private API.

## Display

`✦ Claude 42%` is derived from the latest assistant turn's input and cache token counts. The configured context-window size defaults to 200,000 tokens. The item turns yellow at 75% and red at 90%. Hover for the token breakdown and source time; click for details and a link to the transcript.

## Settings

| Setting | Default | Purpose |
| --- | --- | --- |
| `claudeStatus.claudeHome` | `~/.claude` | Override Claude's data directory. |
| `claudeStatus.refreshIntervalSeconds` | `60` | Local scan interval (minimum 5 seconds). |
| `claudeStatus.lookbackDays` | `7` | Ignore older transcript files. |
| `claudeStatus.contextWindowTokens` | `200000` | Fallback denominator for the displayed percentage. |

## Privacy and format caveat

There are **zero runtime dependencies and zero network calls**. Only file names, timestamps, model names, and numeric usage fields are processed; prompt and response content is never retained or displayed. Claude's transcript schema is not a stable public API, so parsing is deliberately defensive: malformed lines and events without valid usage/timestamps are skipped.

## Development

```sh
npm install
npm test
npx @vscode/vsce package
```
