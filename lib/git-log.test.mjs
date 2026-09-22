import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { GIT_LOG_DEFAULT_LIMIT, GIT_LOG_MAX_LIMIT, clampGitLogLimit, parseGitLog } = await jiti.import("./git-log.ts");

const US = "\u001f";
const RS = "\u001e";

function record(hash, short, author, date, subject) {
  return [hash, short, author, date, subject].join(US) + RS;
}

test("parses commits and keeps field order", () => {
  const stdout = record("a1".repeat(20), "a1", "阿七", "2026-09-22T10:00:00+08:00", "feat: add something")
    + record("b2".repeat(20), "b2", "Bob", "2026-09-21T09:00:00+08:00", "fix: remove something");
  const commits = parseGitLog(stdout);
  assert.equal(commits.length, 2);
  assert.deepEqual(commits[0], {
    hash: "a1".repeat(20),
    short: "a1",
    author: "阿七",
    date: "2026-09-22T10:00:00+08:00",
    subject: "feat: add something",
  });
  assert.equal(commits[1].subject, "fix: remove something");
});

test("keeps separators that appear inside a subject", () => {
  const commits = parseGitLog(record("c3", "c3", "Ann", "2026-01-01T00:00:00Z", "fix: pipes | and colons: fine"));
  assert.equal(commits[0].subject, "fix: pipes | and colons: fine");
});

test("ignores empty output and trailing separators", () => {
  assert.deepEqual(parseGitLog(""), []);
  assert.deepEqual(parseGitLog(RS), []);
  assert.deepEqual(parseGitLog(`\n${RS}\n`), []);
});

test("skips records without a hash", () => {
  assert.deepEqual(parseGitLog(record("", "", "Ann", "2026-01-01T00:00:00Z", "no hash")), []);
});

test("clamps the requested limit", () => {
  assert.equal(clampGitLogLimit(10), 10);
  assert.equal(clampGitLogLimit(0), 1);
  assert.equal(clampGitLogLimit(-5), 1);
  assert.equal(clampGitLogLimit(10_000), GIT_LOG_MAX_LIMIT);
  assert.equal(clampGitLogLimit("50"), GIT_LOG_DEFAULT_LIMIT);
  assert.equal(clampGitLogLimit(Number.NaN), GIT_LOG_DEFAULT_LIMIT);
  assert.equal(clampGitLogLimit(undefined), GIT_LOG_DEFAULT_LIMIT);
  assert.equal(clampGitLogLimit(12.7), 12);
});
