import {
  BOARD_FILE_EXTENSION,
  type Board,
  parseBoard,
  parseBoardFile,
  SCHEMA_VERSION,
  serializeBoard,
} from '@kiyora/model';
import { describe, expect, it } from 'vitest';

const shape = (overrides: Record<string, unknown> = {}) => ({
  h: 80,
  id: 'shape-1',
  kind: 'rectangle',
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
  w: 120,
  x: 0,
  y: 0,
  ...overrides,
});

const board = (overrides: Record<string, unknown> = {}): Board =>
  parseBoard({
    camera: { x: 0, y: 0, zoom: 1 },
    createdAt: 1_700_000_000_000,
    deck: [],
    id: 'board-1',
    schemaVersion: SCHEMA_VERSION,
    settings: { theme: 'light' },
    shapes: [shape()],
    title: 'Untitled',
    updatedAt: 1_700_000_000_000,
    ...overrides,
  });

/**
 * The bytes a board file holds: one JSON document, keys in the schema's order,
 * no whitespace. Written out by hand, so it is a fact about the format and not
 * a copy of whatever the serializer happens to emit.
 */
const FIXTURE =
  '{"camera":{"x":0,"y":0,"zoom":1},"createdAt":1700000000000,"deck":[],"id":"board-1","schemaVersion":1,"settings":{"theme":"light"},"shapes":[{"h":80,"id":"shape-1","locked":false,"opacity":1,"parentId":null,"rotation":0,"style":{"corner":"sharp","dash":"solid","fill":"blue","fillStyle":"pastel","stroke":"ink","strokeWidth":2},"w":120,"x":0,"y":0,"kind":"rectangle"}],"title":"Untitled","updatedAt":1700000000000}';

describe('the board file', () => {
  it('wears the extension a person can recognise', () => {
    expect(BOARD_FILE_EXTENSION).toBe('.kyr.json');
  });

  it('is written as the one canonical JSON document', () => {
    expect(serializeBoard(board())).toBe(FIXTURE);
  });

  it('is read back as the board it holds', () => {
    expect(parseBoardFile(FIXTURE)).toEqual(board());
  });

  it('saves, opens and saves again to the same bytes', () => {
    const bytes = serializeBoard(board());
    expect(serializeBoard(parseBoardFile(bytes))).toBe(bytes);
  });

  it('keeps a board with authored text byte-identical across a round trip', () => {
    const authored = board({ shapes: [shape({ text: 'Ship it' })] });
    const bytes = serializeBoard(authored);
    expect(serializeBoard(parseBoardFile(bytes))).toBe(bytes);
  });

  it('drops what the schema does not own, so a save is always canonical', () => {
    const withDerived = JSON.parse(FIXTURE);
    withDerived.viewport = { x: 1, y: 2 };
    withDerived.shapes[0].bounds = { h: 80, w: 120, x: 0, y: 0 };

    expect(serializeBoard(parseBoardFile(JSON.stringify(withDerived)))).toBe(
      FIXTURE
    );
  });
});

describe('refusing a board file', () => {
  it('names the file when its bytes are not JSON', () => {
    expect(() => parseBoardFile('not json at all')).toThrow(/file/);
    expect(() => parseBoardFile('not json at all')).toThrow(/JSON/);
  });

  it('refuses an empty file', () => {
    expect(() => parseBoardFile('')).toThrow(/file/);
  });

  it('names every field that stopped it being a board', () => {
    expect(() => parseBoardFile('{"id":"board-1"}')).toThrow(
      /camera[\s\S]*shapes[\s\S]*title/
    );
  });

  it('names the board itself when the file holds a value that is not one', () => {
    expect(() => parseBoardFile('[1,2,3]')).toThrow(/board/);
  });
});
