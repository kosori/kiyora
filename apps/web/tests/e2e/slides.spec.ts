import { expect, type Page, test } from '@playwright/test';

/** Wait for the surface to say it can act, so paint is on screen before a gesture. */
const open = async (page: Page): Promise<void> => {
  await page.goto('/');
  await expect(page.getByTestId('canvas')).toHaveAttribute(
    'data-ready',
    'true'
  );
  await page.getByTestId('rail-tab-deck').click();
};

/** The canvas's place on the screen, so board coordinates can be dragged to exactly. */
const canvasBox = async (page: Page) => {
  const box = await page.getByTestId('canvas').boundingBox();

  if (box === null) {
    throw new Error('the canvas has no box');
  }

  return box;
};

const board = (page: Page) => page.getByTestId('board');

const slides = (page: Page) => page.getByTestId('slide');

/** The deck as the panel shows it: the frame each slide presents, in order. */
const slideIds = (page: Page) =>
  slides(page).evaluateAll((rows) =>
    rows.map((row) => row.getAttribute('data-frame-id'))
  );

const drag = async (
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number }
) => {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 6 });
  await page.mouse.up();
};

/** A frame drawn from `(x, y)` to `(x + w, y + h)` on the board. */
const drawFrame = async (
  page: Page,
  box: { x: number; y: number },
  frame: { h: number; w: number; x: number; y: number }
) => {
  await page.keyboard.press('f');
  await drag(
    page,
    { x: box.x + frame.x, y: box.y + frame.y },
    { x: box.x + frame.x + frame.w, y: box.y + frame.y + frame.h }
  );
};

/** A 16:9 template frame's painted box, painted and clipped, in board units. */
const templateFramePath = (page: Page) =>
  board(page).locator('path[d="M 0 0 L 1280 0 L 1280 720 L 0 720 Z"]').first();

/** Every painted label, with the ink and baseline it carries. */
const paintedLabels = (page: Page) =>
  board(page)
    .locator('text')
    .evaluateAll((nodes) =>
      nodes.map((node) => ({
        baseline: Number(node.getAttribute('y')),
        fill: node.getAttribute('fill'),
        text: node.textContent ?? '',
      }))
    );

/** The five templates and the words each paints inside its frame. */
const TEMPLATES = [
  { id: 'title', words: ['Title'] },
  { id: 'title-and-content', words: ['Title', 'Body'] },
  { id: 'two-columns', words: ['Title', 'Left', 'Right'] },
  { id: 'quote', words: ['Quote'] },
  { id: 'blank', words: [] },
] as const;

/** The board bytes the browser has written, read straight from IndexedDB. */
const storedBoard = (page: Page) =>
  page.evaluate(
    async (): Promise<string | null> =>
      new Promise<string | null>((resolve, reject) => {
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
      })
  );

test('a template plants a slide whose frame and words paint', async ({
  page,
}) => {
  await open(page);

  await page.getByTestId('template-title').click();

  await expect(slides(page)).toHaveAttribute('data-frame-id', 'frame-1');
  await expect(templateFramePath(page)).toHaveAttribute(
    'fill',
    'rgba(25, 113, 194, 0.2)'
  );

  const title = board(page).locator('text').filter({ hasText: 'Title' });
  await expect(title).toHaveAttribute('fill', '#1e1e1e');
});

for (const template of TEMPLATES) {
  test(`the ${template.id} template paints its frame and its own words`, async ({
    page,
  }) => {
    await open(page);

    await page.getByTestId(`template-${template.id}`).click();

    await expect(templateFramePath(page)).toHaveAttribute(
      'fill',
      'rgba(25, 113, 194, 0.2)'
    );

    await expect
      .poll(async () => (await paintedLabels(page)).map((label) => label.text))
      .toEqual([...template.words]);

    for (const paint of await paintedLabels(page)) {
      expect(paint.fill).toBe('#1e1e1e');
      expect(paint.baseline).toBeGreaterThan(0);
      expect(paint.baseline).toBeLessThan(720);
    }
  });
}

test('a frame is added as a slide, then reordered, duplicated, skipped and deleted', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);

  await drawFrame(page, box, { h: 300, w: 400, x: 100, y: 100 });
  await page.getByTestId('frame-to-slide').click();
  await page.getByTestId('template-blank').click();

  expect(await slideIds(page)).toEqual(['frame-1', 'frame-2']);

  await slides(page).first().getByTestId('slide-down').click();
  expect(await slideIds(page)).toEqual(['frame-2', 'frame-1']);

  await slides(page).first().getByTestId('slide-skip').click();
  await expect(slides(page).first()).toHaveAttribute('data-skipped', 'true');

  await slides(page).first().getByTestId('slide-duplicate').click();
  expect(await slideIds(page)).toEqual(['frame-2', 'frame-3', 'frame-1']);

  await slides(page).first().getByTestId('slide-delete').click();
  expect(await slideIds(page)).toEqual(['frame-3', 'frame-1']);
});

test('presenting fills the window, navigates by key and leaves with Escape', async ({
  page,
}) => {
  await open(page);
  await page.getByTestId('template-title').click();
  await page.getByTestId('template-blank').click();

  await slides(page)
    .first()
    .getByTestId('slide-notes')
    .fill('Welcome everyone');
  await slides(page).first().getByTestId('slide-notes').blur();

  expect(page.context().pages()).toHaveLength(1);

  await page.getByTestId('present-button').click();

  const overlay = page.getByTestId('present-overlay');
  await expect(overlay).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.fullscreenElement !== null))
    .toBe(true);
  await expect
    .poll(async () => {
      const box = await overlay.boundingBox();
      const viewport = page.viewportSize();
      return (
        box !== null &&
        viewport !== null &&
        Math.round(box.width) === viewport.width &&
        Math.round(box.height) === viewport.height
      );
    })
    .toBe(true);

  await expect(
    page
      .getByTestId('present-slide')
      .locator('path[d="M 0 0 L 1280 0 L 1280 720 L 0 720 Z"]')
      .first()
  ).toHaveAttribute('fill', 'rgba(25, 113, 194, 0.2)');
  await expect(page.getByTestId('present-counter')).toHaveText('1 / 2');
  await expect(page.getByTestId('present-notes')).toHaveText(
    'Welcome everyone'
  );

  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('present-counter')).toHaveText('2 / 2');

  await page.keyboard.press('ArrowLeft');
  await expect(page.getByTestId('present-counter')).toHaveText('1 / 2');

  await page.keyboard.press('Space');
  await expect(page.getByTestId('present-counter')).toHaveText('2 / 2');

  await page.keyboard.press('Escape');
  await expect(overlay).toBeHidden();
  await expect(page.getByTestId('deck')).toBeVisible();

  expect(page.context().pages()).toHaveLength(1);
});

test('notes and a timer are available on screen while presenting', async ({
  page,
}) => {
  await open(page);
  await page.getByTestId('template-title').click();
  await slides(page).first().getByTestId('slide-notes').fill('Remember this');
  await slides(page).first().getByTestId('slide-notes').blur();

  await page.getByTestId('present-button').click();

  await expect(page.getByTestId('present-notes')).toHaveText('Remember this');

  const timer = page.getByTestId('present-timer');
  await expect(timer).toHaveText(/^\d+:\d{2}$/);
  const first = await timer.textContent();
  await expect
    .poll(async () => timer.textContent(), { timeout: 5000 })
    .not.toBe(first);
});

test('presenting changes nothing on the board: no history, no save', async ({
  page,
}) => {
  await open(page);
  await page.getByTestId('template-title').click();
  await expect(page.getByTestId('save-status')).toHaveAttribute(
    'data-state',
    'saved'
  );

  const before = await storedBoard(page);
  expect(before).not.toBeNull();
  const undoBefore = await page.getByTestId('undo').isDisabled();
  const paintBefore = await templateFramePath(page).getAttribute('d');

  await page.evaluate(() => {
    const record = window as unknown as { __saveStates?: string[] };
    const states: string[] = [];
    record.__saveStates = states;
    const status = document.querySelector('[data-testid="save-status"]');
    if (status !== null) {
      new MutationObserver(() =>
        states.push(status.getAttribute('data-state') ?? '')
      ).observe(status, {
        attributeFilter: ['data-state'],
        attributes: true,
      });
    }
  });

  await page.getByTestId('present-button').click();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Space');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('present-overlay')).toBeHidden();
  await page.waitForTimeout(800);

  expect(await storedBoard(page)).toBe(before);
  expect(await page.getByTestId('undo').isDisabled()).toBe(undoBefore);
  expect(await templateFramePath(page).getAttribute('d')).toBe(paintBefore);

  const states = await page.evaluate(
    () => (window as unknown as { __saveStates?: string[] }).__saveStates
  );
  expect(states ?? []).not.toContain('unsaved');
});

test('the presenting keys are in the reference, read from the keymap', async ({
  page,
}) => {
  await open(page);

  await page.keyboard.press('?');

  const rows = page
    .getByRole('dialog', { name: 'Keyboard shortcuts' })
    .locator('li');

  await expect(rows.filter({ hasText: 'Next slide' })).toContainText('→');
  await expect(rows.filter({ hasText: 'Previous slide' })).toContainText('←');
  await expect(rows.filter({ hasText: 'Leave presenting' })).toContainText(
    'ESC'
  );
});
