/**
 * A board of a thousand shapes, built by the loop rather than by hand. The
 * board carries a figure, a text shape or a sticky in every cell of a grid, and
 * a connector every tenth index joins the two shapes before it — the mix the
 * ticket asks for, at the count the architecture was asked to survive.
 */

/** The number of shapes the board carries, and the claim the gate tests. */
export const SHAPE_COUNT = 1000;

const COLUMNS = 40;
const MARGIN = 40;
const COLUMN = 160;
const ROW = 120;
const WIDTH = 110;
const HEIGHT = 80;
const CONNECTOR_EVERY = 10;

const STYLE = {
  corner: 'sharp',
  dash: 'solid',
  fill: 'blue',
  fillStyle: 'pastel',
  stroke: 'ink',
  strokeWidth: 2,
} as const;

const FIGURES = ['rectangle', 'ellipse', 'diamond', 'triangle'] as const;

export type ShapeJson = Record<string, unknown> & { id: string };

export type BoardJson = Record<string, unknown> & {
  id: string;
  shapes: ShapeJson[];
};

/** The board's origin cell, in board units: the first figure a drag can grab. */
export const HERO = { h: HEIGHT, w: WIDTH, x: MARGIN, y: MARGIN };

/** The last sticky's cell, near the far corner the pan has to reach. */
export const FAR = {
  h: HEIGHT,
  id: `shape-${SHAPE_COUNT - 2}`,
  w: WIDTH,
  x: MARGIN + ((SHAPE_COUNT - 2) % COLUMNS) * COLUMN,
  y: MARGIN + Math.floor((SHAPE_COUNT - 2) / COLUMNS) * ROW,
};

/** The path a box paints, so a test can name the shape it expects to see. */
export const boxPath = (box: {
  h: number;
  w: number;
  x: number;
  y: number;
}): string =>
  `M ${box.x} ${box.y} L ${box.x + box.w} ${box.y} L ${box.x + box.w} ${box.y + box.h} L ${box.x} ${box.y + box.h} Z`;

/** The thousand-shape board, ready to seed into storage. */
export const boardOfAThousandShapes = (): BoardJson => {
  const shapes: ShapeJson[] = [];

  for (let index = 0; index < SHAPE_COUNT; index += 1) {
    const column = index % COLUMNS;
    const row = Math.floor(index / COLUMNS);
    const box = {
      h: HEIGHT,
      id: `shape-${index}`,
      locked: false,
      opacity: 1,
      parentId: null,
      rotation: 0,
      style: STYLE,
      w: WIDTH,
      x: MARGIN + column * COLUMN,
      y: MARGIN + row * ROW,
    };

    if (index % CONNECTOR_EVERY === CONNECTOR_EVERY - 1) {
      shapes.push({
        ...box,
        end: 'arrow',
        from: { kind: 'bound', shapeId: `shape-${index - 1}` },
        kind: 'connector',
        route: 'straight',
        start: 'none',
        to: { kind: 'bound', shapeId: `shape-${index - 2}` },
      });
      continue;
    }

    if (index % 3 === 0) {
      shapes.push({ ...box, kind: FIGURES[(index / 3) % FIGURES.length] });
      continue;
    }

    const textStyle = { align: 'center', size: 16, valign: 'middle' };
    if (index % 3 === 1) {
      shapes.push({ ...box, kind: 'text', text: `Note ${index}`, textStyle });
      continue;
    }

    shapes.push({
      ...box,
      kind: 'sticky',
      style: { ...STYLE, fill: 'yellow' },
      text: `Note ${index}`,
      textStyle,
    });
  }

  return {
    camera: { x: 0, y: 0, zoom: 1 },
    createdAt: 1_700_000_000_000,
    deck: [],
    id: 'thousand-shapes',
    schemaVersion: 1,
    settings: { theme: 'light' },
    shapes,
    title: 'A thousand shapes',
    updatedAt: 1_700_000_000_000,
  };
};
