/**
 * A board of many freehand strokes, built by the loop rather than by hand, so
 * the same culling and DOM budget the thousand-shape fixture guards is measured
 * against the kind most likely to grow one node per sample. Every stroke is
 * already simplified, the way the editor stores one, and spread far enough that
 * the first view shows only a corner of the board.
 */

/** The number of strokes the fixture carries. */
export const STROKE_COUNT = 300;

const COLUMNS = 20;
const MARGIN = 40;
const COLUMN = 220;
const ROW = 160;
const WIDTH = 160;
const HEIGHT = 80;

const STYLE = {
  corner: 'sharp',
  dash: 'solid',
  fill: 'blue',
  fillStyle: 'pastel',
  stroke: 'ink',
  strokeWidth: 2,
} as const;

/** A straightened stroke's points, as fractions of its authored box. */
const POINTS = [
  { x: 0, y: 0.5 },
  { x: 0.2, y: 0.2 },
  { x: 0.4, y: 0.8 },
  { x: 0.6, y: 0.3 },
  { x: 0.8, y: 0.7 },
  { x: 1, y: 0.5 },
];

export type ShapeJson = Record<string, unknown> & { id: string };

export type BoardJson = Record<string, unknown> & {
  id: string;
  shapes: ShapeJson[];
};

/** The board of many strokes, ready to seed into storage. */
export const boardOfManyStrokes = (): BoardJson => {
  const shapes: ShapeJson[] = [];

  for (let index = 0; index < STROKE_COUNT; index += 1) {
    shapes.push({
      h: HEIGHT,
      id: `ink-${index}`,
      kind: 'ink',
      locked: false,
      mode: 'pen',
      opacity: 1,
      parentId: null,
      points: POINTS,
      rotation: 0,
      style: STYLE,
      w: WIDTH,
      x: MARGIN + (index % COLUMNS) * COLUMN,
      y: MARGIN + Math.floor(index / COLUMNS) * ROW,
    });
  }

  return {
    camera: { x: 0, y: 0, zoom: 1 },
    createdAt: 1_700_000_000_000,
    deck: [],
    id: 'many-strokes',
    schemaVersion: 3,
    settings: { theme: 'light' },
    shapes,
    title: 'Many strokes',
    updatedAt: 1_700_000_000_000,
  };
};
