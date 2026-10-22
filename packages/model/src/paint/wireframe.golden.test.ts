import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  type Board,
  FIGURE_KINDS,
  type FigureKind,
  type FigureShape,
  type Measurer,
  type PaintContext,
  paintBoard,
  paintShape,
  parseBoard,
  projectBoard,
  SCHEMA_VERSION,
} from '@kiyora/model';
import { describe, expect, it } from 'vitest';

const light: PaintContext = { theme: 'light' };

/** A deterministic measurer: every character is half the run's size wide. */
const fake: Measurer = (run) => run.text.length * run.size * 0.5;

/**
 * The control shapes this build adds. Checkbox and card were already in the
 * grammar; the rest are new names in `SHAPES`, so they reach the picker, the
 * source language and the placement path through the one vocabulary.
 */
const CONTROLS: readonly FigureKind[] = [
  'avatar',
  'badge',
  'breadcrumb',
  'button',
  'card',
  'checkbox',
  'divider',
  'dropdown',
  'input',
  'pagination',
  'radio',
  'slider',
  'table',
  'tabs',
  'text-area',
  'toggle',
];

const control = (kind: FigureKind, overrides: Partial<FigureShape> = {}) => {
  const base: FigureShape = {
    h: 100,
    id: `control-${kind}`,
    kind,
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
    w: 160,
    x: 0,
    y: 0,
    ...overrides,
  };

  return base;
};

const golden = (name: string): string =>
  readFileSync(
    fileURLToPath(new URL(`./goldens/${name}`, import.meta.url)),
    'utf8'
  );

const board = (shapes: unknown[]): Board =>
  parseBoard({
    camera: { x: 0, y: 0, zoom: 1 },
    createdAt: 1_700_000_000_000,
    deck: [],
    id: 'board-wireframe',
    schemaVersion: SCHEMA_VERSION,
    settings: { theme: 'light' },
    shapes,
    title: 'Wireframe controls',
    updatedAt: 1_700_000_000_000,
  });

/** The row, laid out four to a line with the kind's own name under its ink. */
const row = (): Board => {
  const shapes = CONTROLS.map((kind, index) =>
    control(kind, {
      h: 100,
      text: kind,
      w: 160,
      x: 40 + (index % 4) * 200,
      y: 40 + Math.floor(index / 4) * 140,
    })
  );

  return board(shapes);
};

describe('the wireframe controls', () => {
  it('are all reachable as figure kinds, so the picker and placement find them', () => {
    for (const kind of CONTROLS) {
      expect(FIGURE_KINDS).toContain(kind);
    }
  });

  it('paints every control in the board’s own ink, never a screenshot', () => {
    for (const kind of CONTROLS) {
      const paint = paintShape(control(kind), light);

      expect(paint.paths.length).toBeGreaterThan(0);
      expect(
        paint.paths.some(
          (path) => path.fill !== 'none' || path.stroke !== 'none'
        )
      ).toBe(true);

      for (const path of paint.paths) {
        expect(path.stroke).toBe('#1e1e1e');
        expect(path.strokeWidth).toBe(2);
      }
    }
  });

  it('draws each control as its own geometry, not a box with another name', () => {
    const box = paintShape(control('rectangle'), light).paths[0]?.d;

    for (const kind of CONTROLS) {
      const painted = paintShape(control(kind), light)
        .paths.map((path) => path.d)
        .join(' ');

      expect(painted).not.toBe(box);
    }
  });

  it('takes the corner token, so a control is styled like the rest of the board', () => {
    const sharp = paintShape(control('button'), light).paths[0]?.d;
    const rounded = paintShape(
      control('button', {
        style: { ...control('button').style, corner: 'rounded' },
      }),
      light
    ).paths[0]?.d;

    expect(sharp).toBe('M 0 0 L 160 0 L 160 100 L 0 100 Z');
    expect(rounded).toContain('C');
  });

  it('matches the committed golden for the row, so every path is on record', () => {
    const painted = paintBoard(row(), { ...light, measure: fake });

    expect(painted.children).toHaveLength(CONTROLS.length);
    expect(projectBoard(row(), { ...light, measure: fake })).toBe(
      golden('wireframe.svg')
    );
  });
});
