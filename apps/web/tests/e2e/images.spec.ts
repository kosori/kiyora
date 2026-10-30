import { readFile } from 'node:fs/promises';
import { expect, type Page, test } from '../fixtures/offline';

/**
 * Images, driven at the browser seam: a real file input hands in a real PNG, the
 * browser decodes and downscales it, the board paints the authored box, and the
 * artifact paths carry the same bytes. The localStorage case proves the refusal
 * is visible rather than a save that quietly drops the picture.
 */

/** A 16×16 PNG: a real raster the browser can decode, small enough to read here. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAABk0lEQVR4nAXB0QAAIAxAwSlMYQopBPB+ppBCClNIIYUUUkhhCutOBFHEkIZ0xJGBTCSQhWzkIBd5SCKFiKCKGtrQjjo60IkGutCNHvSiD020UBFMMcMa1jHHBjaxwBa2sYNd7GGJFSZCU5rRGq3TnDZokxa0Rdu0Q7u0R0ta0UToSjd6o3e60wd90oO+6Jt+6Jf+6EkvugiuuOEN77jjA5944Avf+MEv/vDECxdhKMMYjdEZzhiMyQjGYmzGYVzGYySjGCJMZRqzMTvTmYM5mcFczM08zMt8zGQWU4RQwohGdMKJQUwiiEVs4hCXeEQSRYiwlGWsxuosZw3WZAVrsTbrsC7rsZJVLBG2so3d2J3t7MGe7GAv9mYf9mU/drKLLcJRjnEap3OcMziTE5zF2ZzDuZzHSU5xRLjKNW7jdq5zB3dyg7u4m3u4l/u4yS2uCE95xmu8znPe4E1e8BZv8w7v8h4vecUTIZU0spGddHKQkwxykZs85CUfmWSRIpRSRjWqU04NalJBLWpTh7rUo5Iq6gOzyU8QNPRlXAAAAABJRU5ErkJggg==',
  'base64'
);

type StoredBoard = {
  files: Record<string, { bytes: number; dataURL: string; mime: string }>;
  shapes: {
    fileId?: string;
    h: number;
    id: string;
    kind: string;
    w: number;
    x: number;
    y: number;
  }[];
};

const open = async (page: Page): Promise<void> => {
  await page.goto('/');
  await expect(page.getByTestId('canvas')).toHaveAttribute(
    'data-ready',
    'true'
  );
};

const placeImage = async (page: Page): Promise<void> => {
  await page.getByTestId('image-input').setInputFiles({
    buffer: PNG,
    mimeType: 'image/png',
    name: 'photo.png',
  });
  await expect(
    page.getByTestId('board').locator('image').first()
  ).toBeVisible();
};

const saved = async (page: Page): Promise<void> => {
  await expect(page.getByTestId('save-status')).toHaveAttribute(
    'data-state',
    'saved'
  );
};

/** The board IndexedDB actually holds. */
const storedBoard = (page: Page): Promise<StoredBoard | null> =>
  page.evaluate(async (): Promise<StoredBoard | null> => {
    const bytes = await new Promise<string | null>((resolve, reject) => {
      const opening = indexedDB.open('kiyora', 1);
      opening.onerror = () => reject(opening.error);
      opening.onsuccess = () => {
        const database = opening.result;
        if (!database.objectStoreNames.contains('boards')) {
          resolve(null);
          return;
        }
        const request = database
          .transaction('boards', 'readonly')
          .objectStore('boards')
          .get('kiyora:board');
        request.onerror = () => reject(request.error);
        request.onsuccess = () =>
          resolve((request.result as string | undefined) ?? null);
      };
    });

    return bytes === null ? null : (JSON.parse(bytes) as StoredBoard);
  });

const image = (page: Page) => page.getByTestId('board').locator('image');

test('a picked PNG paints in its authored box, survives a reload and keeps its bytes', async ({
  page,
}) => {
  await open(page);
  await placeImage(page);
  await saved(page);

  const board = await storedBoard(page);
  const shape = board?.shapes.find((one) => one.kind === 'image');
  const file =
    shape?.fileId === undefined ? undefined : board?.files[shape.fileId];

  expect(file?.mime).toBe('image/png');
  expect(file?.dataURL).toMatch(/^data:image\/png;base64,/);
  expect(shape).toMatchObject({ h: 16, w: 16 });

  await expect(image(page)).toHaveAttribute('href', file?.dataURL ?? '');
  await expect(image(page)).toHaveAttribute('width', '16');
  await expect(image(page)).toHaveAttribute('height', '16');
  await expect(image(page)).toHaveAttribute('x', String(shape?.x));
  await expect(image(page)).toHaveAttribute('y', String(shape?.y));

  await page.reload();
  await expect(page.getByTestId('canvas')).toHaveAttribute(
    'data-ready',
    'true'
  );
  await expect(image(page)).toHaveAttribute('href', file?.dataURL ?? '');
  await expect(image(page)).toHaveAttribute('width', '16');
});

test('a placed image resizes with the selection, and the box is what is stored', async ({
  page,
}) => {
  await open(page);
  await placeImage(page);
  await saved(page);

  const before = await storedBoard(page);
  const placed = before?.shapes.find((one) => one.kind === 'image');
  if (placed === undefined) {
    throw new Error('the placed image is not on the board');
  }

  const painted = await image(page).boundingBox();
  if (painted === null) {
    throw new Error('the painted image has no box');
  }
  await page.mouse.click(
    painted.x + painted.width / 2,
    painted.y + painted.height / 2
  );
  await expect(page.getByTestId('selection-frame')).toBeVisible();

  const handle = page.getByTestId('handle-se');
  const corner = await handle.boundingBox();
  if (corner === null) {
    throw new Error('the corner handle has no box');
  }
  await page.mouse.move(
    corner.x + corner.width / 2,
    corner.y + corner.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(corner.x + 120, corner.y + 96, { steps: 10 });
  await page.mouse.up();
  await saved(page);

  const after = await storedBoard(page);
  const resized = after?.shapes.find((one) => one.kind === 'image');
  if (resized === undefined) {
    throw new Error('the image left the board');
  }

  expect(resized.w).toBeGreaterThan(placed.w);
  expect(resized.h).toBeGreaterThan(placed.h);
  await expect(image(page)).toHaveAttribute('width', String(resized.w));
  await expect(image(page)).toHaveAttribute('height', String(resized.h));
  await expect(image(page)).toHaveAttribute('x', String(resized.x));
  await expect(image(page)).toHaveAttribute('y', String(resized.y));
});

test('placing the same raster twice keeps one payload and two shapes', async ({
  page,
}) => {
  await open(page);
  await placeImage(page);
  await page.getByTestId('image-input').setInputFiles({
    buffer: PNG,
    mimeType: 'image/png',
    name: 'photo.png',
  });
  await expect(page.getByTestId('board').locator('image').nth(1)).toBeVisible();
  await saved(page);

  const board = await storedBoard(page);
  const images = board?.shapes.filter((one) => one.kind === 'image') ?? [];

  expect(images).toHaveLength(2);
  expect(Object.keys(board?.files ?? {})).toHaveLength(1);
});

test('the board leaves as an SVG and a PNG with the raster inside it', async ({
  page,
}) => {
  await open(page);
  await placeImage(page);

  const [svgDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('export-svg').click(),
  ]);
  const svg = await readFile(await svgDownload.path(), 'utf8');

  expect(svg).toContain('<image ');
  expect(svg).toContain('preserveAspectRatio="none"');
  expect(svg).toContain('href="data:image/png;base64,');
  expect(svg).not.toContain('javascript:');

  await page.getByTestId('png-options').click();
  const [pngDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('download-png').click(),
  ]);
  const png = await readFile(await pngDownload.path());

  expect([...png.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  expect(png.length).toBeGreaterThan(PNG.length);
});

test('a board with an image is refused by the localStorage fallback, visibly', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', {
      configurable: true,
      value: undefined,
    });
  });

  await open(page);
  await placeImage(page);

  const status = page.getByTestId('save-status');
  await expect(status).toHaveAttribute('data-fault', 'images');
  await expect(status).toContainText(/Images need IndexedDB/);
  await expect(status).toContainText(/not saved/);

  const written = await page.evaluate(() =>
    localStorage.getItem('kiyora:board')
  );
  const board = written === null ? null : (JSON.parse(written) as StoredBoard);

  expect(board?.files ?? {}).toEqual({});
  await expect(image(page)).toBeVisible();
});

test('the image is in the document, so the offline guard still holds', async ({
  page,
}) => {
  await open(page);
  await placeImage(page);

  await expect(image(page)).toHaveAttribute('href', /^data:image\/png;base64,/);
});
