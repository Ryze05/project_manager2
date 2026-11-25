/**
 * Manual order inside a board column. Each task has a number; the column is
 * sorted by it. Dropping a card between two others takes the middle value, so
 * the rest of the column is not touched. When the gaps get too small to split,
 * the caller renumbers the column (`needsRenumbering`).
 */

/** Smallest gap that can still be split in two. */
export const MIN_GAP = 1e-6;

/**
 * The position for a card dropped after `above` (the card over it, if any) and
 * before `below` (the card under it, if any). `last` is the highest position of
 * the column, used when there is nothing below.
 * Returns null when the neighbours are too close (or out of order): renumber first.
 */
export function positionBetween(
  above: number | null,
  below: number | null,
  last: number,
): number | null {
  if (above === null && below === null) return last + 1; // end of the column
  if (below === null) return (above as number) + 1; // under the last one
  if (above === null) return below - 1; // top of the column
  if (below - above < MIN_GAP * 2) return null;
  return (above + below) / 2;
}
