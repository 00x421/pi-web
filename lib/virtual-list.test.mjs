import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { getVisibleRowRange, rowOffsets, totalRowHeight } = await jiti.import("./virtual-list.ts");

test("rowOffsets accumulates heights and totalRowHeight sums them", () => {
  const heights = [34, 54, 54, 34, 54];
  assert.deepEqual(rowOffsets(heights), [0, 34, 88, 142, 176]);
  assert.equal(totalRowHeight(heights), 230);
});

test("handles an empty list", () => {
  assert.deepEqual(rowOffsets([]), []);
  assert.equal(totalRowHeight([]), 0);
  assert.deepEqual(getVisibleRowRange([], 0, 600), { start: 0, end: 0 });
});

test("returns every row when the list fits the viewport", () => {
  const heights = [34, 54, 54];
  assert.deepEqual(getVisibleRowRange(heights, 0, 600, 0), { start: 0, end: 3 });
});

// The range starts at the last row whose bottom edge reaches the viewport top,
// so a row ending exactly at scrollTop is still mounted.
test("walks past header and session rows with different heights", () => {
  // Row offsets: 0, 34, 88, 142, 176. A viewport at 142 spans the fourth row.
  const heights = [34, 54, 54, 34, 54];
  assert.deepEqual(getVisibleRowRange(heights, 142, 34, 0), { start: 2, end: 5 });
  assert.deepEqual(getVisibleRowRange(heights, 176, 34, 0), { start: 3, end: 5 });
});

test("pads the range by the overscan and clamps at both ends", () => {
  const heights = new Array(20).fill(50);
  assert.deepEqual(getVisibleRowRange(heights, 0, 100, 0), { start: 0, end: 3 });
  assert.deepEqual(getVisibleRowRange(heights, 0, 100, 2), { start: 0, end: 5 });
  assert.deepEqual(getVisibleRowRange(heights, 500, 100, 2), { start: 7, end: 15 });
  assert.deepEqual(getVisibleRowRange(heights, 100_000, 100, 2), { start: 18, end: 20 });
});

test("treats a negative scroll offset as the top of the list", () => {
  const heights = new Array(10).fill(50);
  assert.deepEqual(getVisibleRowRange(heights, -30, 50, 0), { start: 0, end: 2 });
});
