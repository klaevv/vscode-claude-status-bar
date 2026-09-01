const test = require("node:test");
const assert = require("node:assert/strict");
const { coalescedTask } = require("../dist/coalescedTask");

test("overlapping requests become at most one queued rerun", async () => {
  let calls = 0;
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const run = coalescedTask(async () => { calls += 1; if (calls === 1) await gate; });
  const first = run();
  const second = run();
  const third = run();
  release();
  await Promise.all([first, second, third]);
  assert.equal(calls, 2);
});
