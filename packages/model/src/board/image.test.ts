import {
  boardIssues,
  fitImageSize,
  hasImageFiles,
  IMAGE_FILE_LIMIT_BYTES,
  IMAGE_MAX_SIDE,
  type ImageFile,
  imageMimeOf,
  parseBoard,
  SCHEMA_VERSION,
  serializeBoard,
} from '@kiyora/model';
import { describe, expect, it } from 'vitest';

const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const raster = (overrides: Partial<ImageFile> = {}): ImageFile => ({
  bytes: 68,
  dataURL: `data:image/png;base64,${PNG}`,
  mime: 'image/png',
  ...overrides,
});

const imageShape = (overrides: Record<string, unknown> = {}) => ({
  fileId: 'abc123',
  h: 90,
  id: 'image-1',
  kind: 'image',
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
  x: 10,
  y: 20,
  ...overrides,
});

const board = (overrides: Record<string, unknown> = {}) => ({
  camera: { x: 0, y: 0, zoom: 1 },
  createdAt: 1_700_000_000_000,
  deck: [],
  files: { abc123: raster() },
  id: 'board-images',
  schemaVersion: SCHEMA_VERSION,
  settings: { theme: 'light' },
  shapes: [imageShape()],
  title: 'Images',
  updatedAt: 1_700_000_000_000,
  ...overrides,
});

describe('images in the board', () => {
  it('keeps the raster in the files map and the shape that names it', () => {
    const parsed = parseBoard(board());
    const [shape] = parsed.shapes;

    expect(parsed.files.abc123?.mime).toBe('image/png');
    expect(parsed.files.abc123?.dataURL).toMatch(/^data:image\/png;base64,/);
    expect(shape?.kind).toBe('image');
    if (shape?.kind === 'image') {
      expect(shape.fileId).toBe('abc123');
      expect({ h: shape.h, w: shape.w, x: shape.x, y: shape.y }).toEqual({
        h: 90,
        w: 160,
        x: 10,
        y: 20,
      });
    }
  });

  it('round-trips through the canonical JSON without moving a byte of the payload', () => {
    const saved = serializeBoard(parseBoard(board()));
    const reopened = parseBoard(JSON.parse(saved));

    expect(serializeBoard(reopened)).toBe(saved);
    expect(reopened.files.abc123?.dataURL).toBe(`data:image/png;base64,${PNG}`);
  });

  it('fills an empty files map for a board saved before images existed', () => {
    expect(parseBoard(board({ files: undefined })).files).toEqual({});
  });

  it('refuses one image past the per-image cap rather than letting it take the board', () => {
    const issues = boardIssues(
      board({
        files: {
          abc123: raster({ bytes: IMAGE_FILE_LIMIT_BYTES + 1 }),
        },
      })
    );

    expect(issues.map((issue) => issue.path)).toContain('files.abc123.bytes');
  });

  it('accepts a JPEG and refuses a type the board may not carry', () => {
    const jpeg = raster({
      dataURL: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
      mime: 'image/jpeg',
    });
    const svg = raster({
      dataURL: 'data:image/svg+xml;base64,PHN2Zy8+',
      mime: 'image/png',
    });

    expect(boardIssues(board({ files: { ok: jpeg } }))).toEqual([]);
    expect(boardIssues(board({ files: { bad: svg } }))).not.toEqual([]);
  });

  it('refuses a data URL that does not match the type the entry declares', () => {
    const mismatch = raster({
      dataURL: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
      mime: 'image/png',
    });

    expect(boardIssues(board({ files: { mismatch } }))).not.toEqual([]);
  });
});

describe('the import ceiling', () => {
  it('holds a phone photo to the long side without changing its shape', () => {
    expect(fitImageSize({ height: 3000, width: 4000 })).toEqual({
      height: Math.round((3000 * IMAGE_MAX_SIDE) / 4000),
      width: IMAGE_MAX_SIDE,
    });
  });

  it('never grows a picture smaller than the ceiling', () => {
    expect(fitImageSize({ height: 90, width: 160 })).toEqual({
      height: 90,
      width: 160,
    });
  });

  it('reports whether a board carries a payload at all', () => {
    expect(hasImageFiles({ files: {} })).toBe(false);
    expect(hasImageFiles({ files: { abc123: raster() } })).toBe(true);
  });
});

describe('the raster signature', () => {
  it('reads PNG and JPEG from their bytes, whatever the pick claimed', () => {
    expect(
      imageMimeOf(
        new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      )
    ).toBe('image/png');
    expect(imageMimeOf(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe(
      'image/jpeg'
    );
  });

  it('refuses a GIF and a text file wearing an image name', () => {
    expect(imageMimeOf(new TextEncoder().encode('GIF89a'))).toBeNull();
    expect(imageMimeOf(new TextEncoder().encode('<svg/>'))).toBeNull();
  });
});
