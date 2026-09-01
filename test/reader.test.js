const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { lastUsageInFile, listTranscriptFiles, readLatestSnapshot } = require("../dist/reader");

async function fixture(lines) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "claude-status-"));
  const file = path.join(directory, "session.jsonl");
  await fs.writeFile(file, lines.join("\n"));
  return { directory, file };
}

test("reads the newest valid assistant usage and ignores malformed events", async (t) => {
  const { directory, file } = await fixture([
    "not json",
    JSON.stringify({ type: "assistant", timestamp: "invalid", message: { usage: { input_tokens: 999 } } }),
    JSON.stringify({ type: "assistant", timestamp: "2026-08-31T10:00:00-04:00", message: { model: "claude-test", usage: { input_tokens: 100, output_tokens: 5, cache_creation_input_tokens: 20, cache_read_input_tokens: 300 } } }),
    JSON.stringify({ type: "user", timestamp: "2026-09-01T00:00:00Z", message: {} })
  ]);
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const result = await lastUsageInFile(file);
  assert.equal(result.contextTokens, 420);
  assert.equal(result.model, "claude-test");
  assert.equal(result.capturedAt.toISOString(), "2026-08-31T14:00:00.000Z");
});

test("finds nested project transcripts and selects the newest timestamp", async (t) => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "claude-home-"));
  t.after(() => fs.rm(home, { recursive: true, force: true }));
  const project = path.join(home, "projects", "-workspace-project");
  await fs.mkdir(project, { recursive: true });
  const older = path.join(project, "old.jsonl");
  const newer = path.join(project, "new.jsonl");
  await fs.writeFile(older, JSON.stringify({ type: "assistant", timestamp: "2026-08-31T12:00:00Z", message: { usage: { input_tokens: 10 } } }));
  await fs.writeFile(newer, JSON.stringify({ type: "assistant", timestamp: "2026-09-01T12:00:00+02:00", message: { usage: { input_tokens: 20 } } }));
  const now = new Date("2026-09-01T13:00:00Z").valueOf();
  await Promise.all([older, newer].map(file => fs.utimes(file, now / 1000, now / 1000)));
  assert.equal((await listTranscriptFiles(home, 7, now)).length, 2);
  const result = await readLatestSnapshot(home, 7);
  assert.equal(result.contextTokens, 20);
  assert.equal(result.capturedAt.toISOString(), "2026-09-01T10:00:00.000Z");
});
