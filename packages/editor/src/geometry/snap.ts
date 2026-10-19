/**
 * Snapping: the eight-unit grid every drag lands on. A snapped translation is
 * computed from the selection's own origin, so a whole selection moves by one
 * offset and keeps its relative positions rather than each shape snapping on
 * its own.
 */

/** The grid a drag lands on, in board units. */
export const GRID = 8;

/** A nudge's fine step: one board unit, a pixel at one hundred percent zoom. */
export const NUDGE_STEP = 1;

/** The nearest multiple of the grid. */
export const snapValue = (value: number): number =>
  Math.round(value / GRID) * GRID;

/**
 * The translation that puts `origin + delta` on the grid, so the origin of a
 * selection can be snapped without deforming the shapes around it.
 */
export const snapTranslation = (delta: number, origin: number): number =>
  snapValue(origin + delta) - origin;
