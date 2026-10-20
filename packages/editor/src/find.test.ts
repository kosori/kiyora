import { findMatches } from '@kiyora/editor';
import {
  type Board,
  type ConnectorShape,
  type FigureShape,
  type FrameShape,
  type GroupShape,
  parseBoard,
  SCHEMA_VERSION,
  type Shape,
  type StickyShape,
} from '@kiyora/model';
import { describe, expect, it } from 'vitest';

const style = {
  corner: 'sharp',
  dash: 'solid',
  fill: 'blue',
  fillStyle: 'pastel',
  stroke: 'ink',
  strokeWidth: 2,
} as const;

const rectangle = (overrides: Partial<FigureShape> = {}): Shape => ({
  h: 60,
  id: 'rectangle-1',
  kind: 'rectangle',
  locked: false,
  opacity: 1,
  parentId: null,
  rotation: 0,
  style,
  w: 100,
  x: 0,
  y: 0,
  ...overrides,
});

const frame = (overrides: Partial<FrameShape> = {}): Shape => ({
  clip: false,
  h: 200,
  id: 'frame-1',
  kind: 'frame',
  locked: false,
  opacity: 1,
  parentId: null,
  rotation: 0,
  style,
  variant: 'plain',
  w: 300,
  x: 0,
  y: 0,
  ...overrides,
});

const sticky = (overrides: Partial<StickyShape> = {}): Shape => ({
  fit: 'auto',
  h: 160,
  id: 'sticky-1',
  kind: 'sticky',
  locked: false,
  opacity: 1,
  parentId: null,
  rotation: 0,
  style,
  w: 160,
  x: 0,
  y: 0,
  ...overrides,
});

const group = (overrides: Partial<GroupShape> = {}): Shape => ({
  h: 0,
  id: 'group-1',
  kind: 'group',
  locked: false,
  opacity: 1,
  parentId: null,
  rotation: 0,
  style,
  w: 0,
  x: 0,
  y: 0,
  ...overrides,
});

const connector = (overrides: Partial<ConnectorShape> = {}): Shape => ({
  end: 'arrow',
  from: { kind: 'bound', shapeId: 'rectangle-1' },
  h: 0,
  id: 'connector-1',
  kind: 'connector',
  locked: false,
  opacity: 1,
  parentId: null,
  rotation: 0,
  route: 'straight',
  start: 'none',
  style,
  to: { kind: 'bound', shapeId: 'rectangle-2' },
  w: 0,
  x: 0,
  y: 0,
  ...overrides,
});

const board = (shapes: Shape[]): Board =>
  parseBoard({
    camera: { x: 0, y: 0, zoom: 1 },
    createdAt: 1_700_000_000_000,
    deck: [],
    id: 'board-1',
    schemaVersion: SCHEMA_VERSION,
    settings: { theme: 'light' },
    shapes,
    title: 'Find',
    updatedAt: 1_700_000_000_000,
  });

const ids = (shapes: Shape[]): string[] => shapes.map((shape) => shape.id);

describe('finding authored text', () => {
  it('matches a substring case-insensitively, in paint order', () => {
    const subject = board([
      rectangle({ id: 'first', text: 'Ship the release' }),
      sticky({ id: 'second', text: 'Ship it twice' }),
      rectangle({ id: 'third', text: 'Unrelated' }),
    ]);

    expect(ids(findMatches(subject, 'SHIP'))).toEqual(['first', 'second']);
    expect(ids(findMatches(subject, 'the rel'))).toEqual(['first']);
  });

  it('searches the text a person wrote, not the runs paint derives from it', () => {
    const subject = board([
      rectangle({ text: '**Ship**' }),
      sticky({ id: 'sticky-1', text: 'Ship it' }),
    ]);

    expect(ids(findMatches(subject, '**'))).toEqual(['rectangle-1']);
    expect(ids(findMatches(subject, 'Ship'))).toEqual([
      'rectangle-1',
      'sticky-1',
    ]);
  });

  it('finds a frame title and a connector label, so every authored label is searchable', () => {
    const subject = board([
      frame({ text: 'Release plan' }),
      connector({ text: 'blocks' }),
    ]);

    expect(ids(findMatches(subject, 'plan'))).toEqual(['frame-1']);
    expect(ids(findMatches(subject, 'block'))).toEqual(['connector-1']);
  });

  it('ignores a shape with no label, and a frame whose source is not a label', () => {
    const subject = board([
      rectangle(),
      frame({
        source: { generatedIds: [], stale: false, text: 'Release plan' },
      }),
    ]);

    expect(findMatches(subject, 'rectangle')).toEqual([]);
    expect(findMatches(subject, 'Release plan')).toEqual([]);
  });

  it('returns nothing for an empty query, so opening the box changes nothing', () => {
    expect(findMatches(board([rectangle({ text: 'Plan' })]), '')).toEqual([]);
  });

  it('searches a group and its members separately, each by its own text', () => {
    const subject = board([
      group({ id: 'group-1', text: 'Shipping' }),
      rectangle({
        id: 'rectangle-1',
        parentId: 'group-1',
        text: 'Labels',
      }),
    ]);

    expect(ids(findMatches(subject, 'Shipping'))).toEqual(['group-1']);
    expect(ids(findMatches(subject, 'Labels'))).toEqual(['rectangle-1']);
  });

  it('finds a locked shape, because the lock protects geometry and not discovery', () => {
    const subject = board([rectangle({ locked: true, text: 'Locked label' })]);

    expect(ids(findMatches(subject, 'locked'))).toEqual(['rectangle-1']);
  });
});
