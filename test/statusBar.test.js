const test = require("node:test");
const assert = require("node:assert/strict");
const { renderStatus } = require("../dist/statusBar");

function snapshot(contextTokens) {
  return {
    contextTokens,
    usage: { inputTokens: contextTokens, outputTokens: 1, cacheCreationInputTokens: 0, cacheReadInputTokens: 0 },
    sourceFile: "/tmp/session.jsonl",
    capturedAt: new Date("2026-09-01T00:00:00Z")
  };
}

test("renders percentages and threshold severities", () => {
  assert.equal(renderStatus(snapshot(100_000), 200_000).text, "$(sparkle) 100k/200k");
  assert.equal(renderStatus(snapshot(150_000), 200_000).severity, "warning");
  assert.equal(renderStatus(snapshot(180_000), 200_000).severity, "error");
});
