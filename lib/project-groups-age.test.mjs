import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { splitByAge } = await jiti.import("./project-groups.ts");

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-09-22T12:00:00.000Z");
const stamp = (daysAgo) => new Date(NOW - daysAgo * DAY).toISOString();
const items = (...days) => days.map((daysAgo, index) => ({ id: index, modified: stamp(daysAgo) }));
const byModified = (item) => item.modified;

test("splits sessions by age and keeps the input order inside each part", () => {
  const { recent, older } = splitByAge(items(0, 2, 30, 1), 7, byModified, NOW);
  assert.deepEqual(recent.map((item) => item.id), [0, 1, 3]);
  assert.deepEqual(older.map((item) => item.id), [2]);
});

test("keeps a session exactly at the cutoff visible", () => {
  const { recent, older } = splitByAge(items(7), 7, byModified, NOW);
  assert.equal(recent.length, 1);
  assert.equal(older.length, 0);
});

test("never hides an item whose timestamp cannot be read", () => {
  const broken = [{ modified: undefined }, { modified: "not a date" }, { modified: Number.NaN }];
  const { recent, older } = splitByAge(broken, 7, byModified, NOW);
  assert.equal(recent.length, 3);
  assert.equal(older.length, 0);
});

test("treats a numeric timestamp as a real date", () => {
  const { recent, older } = splitByAge([{ modified: 0 }], 7, byModified, NOW);
  assert.equal(recent.length, 0);
  assert.equal(older.length, 1);
});

test("handles an empty list", () => {
  const { recent, older } = splitByAge([], 7, byModified, NOW);
  assert.deepEqual(recent, []);
  assert.deepEqual(older, []);
});
