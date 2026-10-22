import { readFileSync } from 'node:fs';
import {
  BOARD_FILE_EXTENSION,
  BOARD_FILE_LIMIT_BYTES,
  type Board,
  BoardFileFault,
  type Measurer,
  paintBoard,
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
  '{"camera":{"x":0,"y":0,"zoom":1},"createdAt":1700000000000,"deck":[],"id":"board-1","schemaVersion":3,"settings":{"theme":"light"},"shapes":[{"h":80,"id":"shape-1","locked":false,"opacity":1,"parentId":null,"rotation":0,"style":{"corner":"sharp","dash":"solid","fill":"blue","fillStyle":"pastel","stroke":"ink","strokeWidth":2},"w":120,"x":0,"y":0,"kind":"rectangle"}],"title":"Untitled","updatedAt":1700000000000}';

/** The committed board one version before this build, read as the bytes a save left. */
const older = (): string =>
  readFileSync(new URL('../board/fixtures/v1.json', import.meta.url), 'utf8');

/** A measurer that needs no DOM, so a labelled board paints in a test. */
const measure: Measurer = (run) => run.text.length * run.size * 0.5;

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

describe('opening a board saved before this build', () => {
  it('lifts the version, and leaves the camera, deck and settings as they were', () => {
    const before = JSON.parse(older()) as Record<string, unknown>;
    const opened = parseBoardFile(older());

    expect(opened.schemaVersion).toBe(SCHEMA_VERSION);
    expect(opened.camera).toEqual(before.camera);
    expect(opened.deck).toEqual(before.deck);
    expect(opened.settings).toEqual(before.settings);
    expect(opened.shapes).toHaveLength((before.shapes as unknown[]).length);
  });

  it('paints the lifted board exactly as the newest fixture paints', () => {
    const newest = JSON.parse(
      readFileSync(
        new URL('../board/fixtures/v3.json', import.meta.url),
        'utf8'
      )
    );

    expect(
      paintBoard(parseBoardFile(older()), { measure, theme: 'dark' })
    ).toEqual(paintBoard(parseBoard(newest), { measure, theme: 'dark' }));
  });

  it('writes the newest version on save, so a file migrates once', () => {
    const saved = serializeBoard(parseBoardFile(older()));

    expect(JSON.parse(saved).schemaVersion).toBe(SCHEMA_VERSION);
    expect(serializeBoard(parseBoardFile(saved))).toBe(saved);
  });

  it('round-trips a board with no source and no group unchanged after one save', () => {
    const before = JSON.parse(older()) as Record<string, unknown>;
    const saved = JSON.parse(serializeBoard(parseBoardFile(older()))) as Record<
      string,
      unknown
    >;
    // The fixture predates the corner and dash defaults, so the board as this
    // build reads it is the yardstick; a Source or a Group added by the lift
    // would still show up as a difference.
    const asRead = parseBoard({ ...before, schemaVersion: SCHEMA_VERSION });

    expect({ ...saved, schemaVersion: before.schemaVersion }).toEqual({
      ...before,
      shapes: asRead.shapes,
    });
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

  it('refuses a file from a release newer than this build, rather than mangling it', () => {
    const future = JSON.stringify({
      ...JSON.parse(older()),
      schemaVersion: SCHEMA_VERSION + 1,
    });

    expect(() => parseBoardFile(future)).toThrow(/schemaVersion/);
    expect(() => parseBoardFile(future)).toThrow(
      new RegExp(String(SCHEMA_VERSION + 1))
    );
  });

  it('refuses a file past the byte cap with a typed fault, before it parses', () => {
    const oversized = 'x'.repeat(BOARD_FILE_LIMIT_BYTES + 1);

    expect(() => parseBoardFile(oversized)).toThrow(BoardFileFault);
    expect(() => parseBoardFile(oversized)).toThrow(
      new RegExp(`${BOARD_FILE_LIMIT_BYTES}-byte cap`)
    );
  });

  it('carries the size that broke the cap, so the surface can name it', () => {
    try {
      parseBoardFile('x'.repeat(BOARD_FILE_LIMIT_BYTES + 1));
    } catch (error) {
      expect(error).toBeInstanceOf(BoardFileFault);
      expect(error).toMatchObject({
        bytes: BOARD_FILE_LIMIT_BYTES + 1,
        limit: BOARD_FILE_LIMIT_BYTES,
      });
    }
  });
});
