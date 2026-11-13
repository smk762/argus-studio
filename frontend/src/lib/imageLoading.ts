/**
 * How many tiles fill the first row of the widest thumbnail grid (the curator
 * and archive grids go up to six columns). Those tiles are on screen when the
 * page loads and are the likeliest Largest Contentful Paint, so they must not
 * wait on lazy loading; everything after them can.
 */
export const FIRST_ROW = 6;

/** Whether the tile at `position` sits in a grid's first row of `firstRow` tiles. */
export function inFirstRow(position: number, firstRow: number = FIRST_ROW): boolean {
  return position < firstRow;
}

/**
 * The `loading` attribute for the tile at `position` in a grid: unset (the
 * browser's eager default) for the first row, `"lazy"` after it. Never
 * `"eager"` spelled out, and no `fetchpriority`: tiles are equal-sized, so none
 * is singled out as the LCP image.
 */
export function tileLoading(position: number, firstRow: number = FIRST_ROW): "lazy" | undefined {
  return inFirstRow(position, firstRow) ? undefined : "lazy";
}
