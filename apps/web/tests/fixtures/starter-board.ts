import type { SeededBoard } from './library';

/** The board v1.5 opened on: one rectangle, at the id and title it always had. */
export const starterBoard = (): SeededBoard => ({
  camera: { x: 0, y: 0, zoom: 1 },
  createdAt: 1_700_000_000_000,
  deck: [],
  files: {},
  id: 'starter-board',
  schemaVersion: 3,
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

/** The address the starter board opens at. */
export const STARTER_PATH = '/b/starter-board';
