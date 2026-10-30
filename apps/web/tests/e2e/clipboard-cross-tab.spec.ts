import { SCHEMA_VERSION } from '@kiyora/model';
import { expect, type Page, test } from '../fixtures/offline';
import { expectPaintedDs } from './paint';

/**
 * The first spec in this repo that opens a second tab. Tabs in one browser
 * context share a `BroadcastChannel`, which is how the clipboard crosses; the
 * board never leaves the machine and no request is made to carry it. Every test
 * here runs behind the shared offline guard, so the feature has to work offline.
 */

const open = async (page: Page): Promise<void> => {
  await page.goto('/');
  await expect(page.getByTestId('canvas')).toHaveAttribute(
    'data-ready',
    'true'
  );
};

/** The canvas's place on screen, so a click lands at a board coordinate. */
const canvasBox = async (page: Page) => {
  const box = await page.getByTestId('canvas').boundingBox();

  if (box === null) {
    throw new Error('the canvas has no box');
  }

  return box;
};

const drag = async (
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number }
) => {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
};

type ClipboardWindow = Window & { __clipboard?: unknown[] };

/** Listens on the board channel in `page` and keeps every message it sees. */
const watchChannel = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    const scope = window as ClipboardWindow;
    scope.__clipboard = [];
    const channel = new BroadcastChannel('kiyora:board');
    channel.addEventListener('message', (event) => {
      scope.__clipboard?.push(event.data);
    });
  });
};

/** The clipboard messages `page` saw, ignoring the presence handshake. */
const clipboardMessages = (page: Page) =>
  page.evaluate(() =>
    ((window as ClipboardWindow).__clipboard ?? []).filter(
      (message): message is Record<string, unknown> =>
        typeof message === 'object' &&
        message !== null &&
        (message as Record<string, unknown>).type === 'clipboard'
    )
  );

/** Waits until `page` has seen `count` clipboard messages on the channel. */
const expectClipboardMessages = async (
  page: Page,
  count: number
): Promise<void> => {
  await expect
    .poll(async () => (await clipboardMessages(page)).length)
    .toBe(count);
};

const shapePaths = (page: Page) =>
  page.getByTestId('board').locator('path[data-shape]');

const ORIGINAL = 'M 80 80 L 300 80 L 300 220 L 80 220 Z';
const COPIED = 'M 104 104 L 324 104 L 324 244 L 104 244 Z';

test('a copy in one tab pastes in another with a fresh id and an offset', async ({
  context,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'the clipboard is proven in Chromium');
  const first = await context.newPage();
  await open(first);
  const box = await canvasBox(first);
  await first.mouse.click(box.x + 150, box.y + 150);
  await expect(shapePaths(first).first()).toHaveAttribute('d', ORIGINAL);

  const second = await context.newPage();
  await open(second);
  await watchChannel(second);

  await first.keyboard.press('Control+c');
  await expectClipboardMessages(second, 1);

  const [message] = await clipboardMessages(second);
  expect(message).toMatchObject({
    schemaVersion: SCHEMA_VERSION,
    type: 'clipboard',
  });
  expect(message?.shapes).toHaveLength(1);

  await expect(second.getByTestId('save-status')).toHaveAttribute(
    'data-secondary',
    'true'
  );

  await second.keyboard.press('Control+v');

  await expect(shapePaths(second).nth(1)).toHaveAttribute('d', COPIED);
  await expect(shapePaths(second).nth(0)).toHaveAttribute('d', ORIGINAL);
});

test('a connector between two copied shapes keeps both ends across tabs', async ({
  context,
}) => {
  const first = await context.newPage();
  await open(first);
  const box = await canvasBox(first);
  const second = await context.newPage();
  await open(second);
  await watchChannel(second);

  await first.keyboard.press('r');
  await drag(
    first,
    { x: box.x + 500, y: box.y + 80 },
    { x: box.x + 600, y: box.y + 180 }
  );

  await first.keyboard.press('c');
  await drag(
    first,
    { x: box.x + 200, y: box.y + 150 },
    { x: box.x + 550, y: box.y + 130 }
  );

  await first.mouse.click(box.x + 150, box.y + 150);
  await first.keyboard.down('Shift');
  await first.mouse.click(box.x + 550, box.y + 130);
  await first.keyboard.up('Shift');

  await first.keyboard.press('Control+c');
  await expectClipboardMessages(second, 1);

  const [message] = await clipboardMessages(second);
  expect(message?.shapes).toHaveLength(3);

  await second.keyboard.press('Control+v');

  const copiedLine = second
    .getByTestId('board')
    .locator('path[data-shape="connector-1"]')
    .first();
  await expect(copiedLine).toHaveAttribute('d', 'M 324 154 L 524 174');
});

test('a copied frame keeps its child inside the frame in the other tab', async ({
  context,
}) => {
  const first = await context.newPage();
  await open(first);
  const box = await canvasBox(first);
  const second = await context.newPage();
  await open(second);
  await watchChannel(second);

  await first.keyboard.press('f');
  await drag(
    first,
    { x: box.x + 300, y: box.y + 40 },
    { x: box.x + 700, y: box.y + 360 }
  );
  await first.keyboard.press('r');
  await drag(
    first,
    { x: box.x + 340, y: box.y + 80 },
    { x: box.x + 440, y: box.y + 160 }
  );

  await first.mouse.click(box.x + 310, box.y + 50);

  await first.keyboard.press('Control+c');
  await expectClipboardMessages(second, 1);

  await second.keyboard.press('Control+v');

  const frame = second
    .getByTestId('board')
    .locator('path[data-shape="frame-1"]')
    .first();
  await expect(frame).toBeVisible();
  await expectPaintedDs(
    second
      .getByTestId('board')
      .locator('g[clip-path="url(#clip-frame-1)"] path[data-shape]'),
    ['M 364 104 L 464 104 L 464 184 L 364 184 Z']
  );
});

test('a copied child without its frame is re-rooted, not left naming a missing parent', async ({
  context,
}) => {
  const first = await context.newPage();
  await open(first);
  const box = await canvasBox(first);
  const second = await context.newPage();
  await open(second);
  await watchChannel(second);

  await first.keyboard.press('f');
  await drag(
    first,
    { x: box.x + 300, y: box.y + 40 },
    { x: box.x + 700, y: box.y + 360 }
  );
  await first.keyboard.press('r');
  await drag(
    first,
    { x: box.x + 340, y: box.y + 80 },
    { x: box.x + 440, y: box.y + 160 }
  );

  await first.mouse.click(box.x + 390, box.y + 120);

  await first.keyboard.press('Control+c');
  await expectClipboardMessages(second, 1);

  const [message] = await clipboardMessages(second);
  const shapes = message?.shapes as { parentId: string | null }[];
  expect(shapes[0]?.parentId).toBeNull();

  await second.keyboard.press('Control+v');

  await expectPaintedDs(
    second.getByTestId('board').locator('path[data-shape="rectangle-1"]'),
    ['M 364 104 L 464 104 L 464 184 L 364 184 Z']
  );
  await expect(
    second.getByTestId('board').locator('g[clip-path]').first()
  ).toBeHidden();
});

test('copy as PNG puts the selection on the clipboard at its own size', async ({
  context,
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'the clipboard is proven in Chromium');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await open(page);
  const box = await canvasBox(page);

  await page.mouse.click(box.x + 150, box.y + 150);
  await page.getByTestId('png-options').click();
  await page.getByTestId('copy-png').click();

  await expect
    .poll(async () =>
      page.evaluate(async () => {
        const items = await navigator.clipboard.read();
        return items.some((item) => item.types.includes('image/png'));
      })
    )
    .toBe(true);

  const size = await page.evaluate(async () => {
    const items = await navigator.clipboard.read();
    const item = items.find((entry) => entry.types.includes('image/png'));

    if (item === undefined) {
      throw new Error('the clipboard holds no PNG');
    }
    const bitmap = await createImageBitmap(await item.getType('image/png'));

    return { height: bitmap.height, width: bitmap.width };
  });

  expect(size).toEqual({ height: 140, width: 220 });
});
