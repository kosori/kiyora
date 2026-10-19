import { type Board, parseBoard, SCHEMA_VERSION } from '@kiyora/model';

/**
 * The board the editor opens on: one rectangle. Built through the schema, so it
 * is valid by construction rather than by inspection. Persistence (#17) takes
 * over the seed; the shape stays.
 */
export const starterBoard = (): Board =>
  parseBoard({
    camera: { x: 0, y: 0, zoom: 1 },
    createdAt: 1_700_000_000_000,
    deck: [],
    id: 'starter-board',
    schemaVersion: SCHEMA_VERSION,
    settings: { theme: 'light' },
    shapes: [
      {
        h: 140,
        id: 'starter-rectangle',
        kind: 'rectangle',
        locked: false,
        opacity: 1,
        parentId: null,
        rotation: 0,
        style: {
          corner: 'sharp',
          dash: 'solid',
          fill: 'green',
          fillStyle: 'bold',
          stroke: 'green',
          strokeWidth: 2,
        },
        w: 220,
        x: 80,
        y: 80,
      },
    ],
    title: 'Kiyora',
    updatedAt: 1_700_000_000_000,
  });
