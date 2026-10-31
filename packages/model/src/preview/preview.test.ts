import type { Measurer } from '@kiyora/model';
import {
  type Board,
  type Paint,
  type PaintPath,
  PREVIEW_WIDTH,
  paintBoard,
  parseBoard,
  previewBoard,
  SCHEMA_VERSION,
  unsafeSvg,
} from '@kiyora/model';
import { describe, expect, it } from 'vitest';

const measure: Measurer = (run) => run.text.length * run.size * 0.6;

const icons = { star: 'M4 4 L20 20' };

const frame = {
  clip: true,
  h: 300,
  id: 'frame-1',
  kind: 'frame',
  locked: false,
  opacity: 1,
  parentId: null,
  rotation: 0,
  style: {
    corner: 'sharp',
    dash: 'solid',
    fill: 'blue',
    fillStyle: 'pastel',
    stroke: 'ink',
    strokeWidth: 2,
  },
  variant: 'plain',
  w: 400,
  x: 0,
  y: 0,
};

const icon = {
  h: 40,
  id: 'icon-1',
  kind: 'icon',
  locked: false,
  name: 'star',
  opacity: 1,
  parentId: 'frame-1',
  rotation: 0,
  style: {
    corner: 'sharp',
    dash: 'solid',
    fill: 'gray',
    fillStyle: 'outline',
    stroke: 'green',
    strokeWidth: 2,
  },
  w: 40,
  x: 40,
  y: 40,
};

const label = {
  h: 40,
  id: 'label-1',
  kind: 'text',
  locked: false,
  opacity: 1,
  parentId: 'frame-1',
  rotation: 0,
  style: {
    corner: 'sharp',
    dash: 'solid',
    fill: 'gray',
    fillStyle: 'outline',
    stroke: 'ink',
    strokeWidth: 0,
  },
  text: 'Note',
  w: 120,
  x: 200,
  y: 40,
};

const board = (shapes: unknown[], title = 'Preview'): Board =>
  parseBoard({
    camera: { x: 0, y: 0, zoom: 1 },
    createdAt: 1_700_000_000_000,
    deck: [],
    id: 'board-1',
    schemaVersion: SCHEMA_VERSION,
    settings: { theme: 'light' },
    shapes,
    title,
    updatedAt: 1_700_000_000_000,
  });

const pathsOf = (paint: Paint): PaintPath[] => [
  ...paint.paths,
  ...paint.children.flatMap(pathsOf),
];

describe('a board preview', () => {
  it("paints the board's own shapes, clipped to its content bounds, at the preview width", () => {
    const painted = board([frame, icon, label]);
    const preview = previewBoard(painted, { icons, measure, theme: 'light' });

    expect(preview).not.toBeNull();
    if (preview === null) {
      return;
    }

    expect(preview).toContain('viewBox="0 0 400 300"');
    expect(preview).toContain(`width="${PREVIEW_WIDTH}"`);
    expect(preview).toContain('height="180"');

    for (const path of pathsOf(
      paintBoard(painted, { icons, measure, theme: 'light' })
    )) {
      expect(preview).toContain(`d="${path.d}"`);
    }
    expect(preview).toContain('>Note</tspan>');
    expect(unsafeSvg(preview)).toBeNull();
  });

  it('is identical twice, so the same board and measurer paint the same preview', () => {
    const painted = board([frame, icon, label]);

    expect(previewBoard(painted, { icons, measure, theme: 'light' })).toBe(
      previewBoard(painted, { icons, measure, theme: 'light' })
    );
  });

  it('is a valid empty document when the board paints nothing', () => {
    const preview = previewBoard(board([]), { theme: 'light' });

    expect(preview).not.toBeNull();
    expect(preview?.startsWith('<svg ')).toBe(true);
    expect(preview?.endsWith('</svg>\n')).toBe(true);
    expect(preview).toContain('viewBox="0 0 0 0"');
    expect(preview).not.toContain('<path');
  });

  it('is omitted rather than truncated when it would pass the cap', () => {
    const painted = board([frame, icon, label]);

    expect(
      previewBoard(painted, { icons, limitBytes: 1, measure, theme: 'light' })
    ).toBeNull();
  });
});
