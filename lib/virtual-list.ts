/**
 * Virtual scrolling for a list whose rows do not all have the same height
 * (the sidebar renders a project header above each group of sessions).
 *
 * Both helpers work on a plain array of row heights, so they stay testable
 * without a DOM.
 */

/** Prefix sums: `offsets[i]` is the distance from the top to row `i`. */
export function rowOffsets(heights: readonly number[]): number[] {
  const offsets = new Array<number>(heights.length);
  let accumulated = 0;
  for (let index = 0; index < heights.length; index += 1) {
    offsets[index] = accumulated;
    accumulated += heights[index];
  }
  return offsets;
}

export function totalRowHeight(heights: readonly number[]): number {
  let total = 0;
  for (const height of heights) total += height;
  return total;
}

/**
 * Index range of the rows that intersect the viewport, padded by `overscanRows`
 * on both sides so scrolling does not flash empty space.
 */
export function getVisibleRowRange(
  heights: readonly number[],
  scrollTop: number,
  viewportHeight: number,
  overscanRows = 4,
): { start: number; end: number } {
  if (heights.length === 0) return { start: 0, end: 0 };

  const viewTop = Math.max(0, scrollTop);
  const viewBottom = viewTop + Math.max(0, viewportHeight);

  let start = 0;
  let offset = 0;
  while (start < heights.length && offset + heights[start] < viewTop) {
    offset += heights[start];
    start += 1;
  }

  let end = start;
  let endOffset = offset;
  while (end < heights.length && endOffset <= viewBottom) {
    endOffset += heights[end];
    end += 1;
  }

  return {
    start: Math.max(0, start - overscanRows),
    end: Math.min(heights.length, end + overscanRows),
  };
}
