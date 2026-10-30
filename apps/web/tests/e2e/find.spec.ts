import { expect, type Page, test } from '../fixtures/offline';

const TRANSFORM = /translate\((-?[\d.]+) (-?[\d.]+)\) scale\((-?[\d.]+)\)/;

/** The board is server-rendered; every test opens once the surface can act. */
const open = async (page: Page): Promise<void> => {
  await page.goto('/');
  await expect(page.getByTestId('canvas')).toHaveAttribute(
    'data-ready',
    'true'
  );
};

const canvasBox = async (page: Page) => {
  const box = await page.getByTestId('canvas').boundingBox();

  if (box === null) {
    throw new Error('the canvas has no box');
  }

  return box;
};

const camera = async (page: Page) => {
  const value = await page.getByTestId('board').getAttribute('transform');
  const match = TRANSFORM.exec(value ?? '');

  if (match === null) {
    throw new Error(`the board is not placed by a camera: ${value}`);
  }

  return {
    x: Number(match[1]),
    y: Number(match[2]),
    zoom: Number(match[3]),
  };
};

const frame = (page: Page) => page.getByTestId('selection-frame');
const find = (page: Page) => page.getByTestId('find-input');
const lockToggle = (page: Page) => page.getByTestId('lock-toggle');

/** The starter rectangle's label box, in board units. */
const STARTER = { h: 140, w: 220, x: 80, y: 80 };

/** Double-click the starter rectangle and type its label. */
const labelStarter = async (
  page: Page,
  box: { x: number; y: number },
  words: string
) => {
  await page.mouse.dblclick(box.x + 190, box.y + 150);
  const editor = page.getByTestId('text-editor');
  await editor.fill(words);
  await editor.blur();
};

/** Place a text shape at a board point and type its words. */
const placeText = async (
  page: Page,
  box: { x: number; y: number },
  at: { x: number; y: number },
  words: string
) => {
  await page.getByRole('button', { exact: true, name: 'Text' }).click();
  await page.mouse.click(box.x + at.x, box.y + at.y);
  const editor = page.getByTestId('text-editor');
  await editor.fill(words);
  await editor.blur();
};

/** Drag the board so the starter rectangle leaves the viewport. */
const hideStarter = async (
  page: Page,
  box: { height: number; width: number; x: number; y: number }
): Promise<void> => {
  await page.mouse.move(box.x + box.width - 100, box.y + box.height / 2);
  await page.mouse.down({ button: 'middle' });
  await page.mouse.move(box.x + 60, box.y + 60, { steps: 6 });
  await page.mouse.up({ button: 'middle' });
};

/** Where a board point lands on the page, through the camera and the canvas box. */
const onScreen = async (
  page: Page,
  box: { x: number; y: number },
  point: { x: number; y: number }
) => {
  const view = await camera(page);

  return {
    x: point.x * view.zoom + view.x + box.x,
    y: point.y * view.zoom + view.y + box.y,
  };
};

test('Mod+F finds authored text, selects the match and brings it into view', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);
  await labelStarter(page, box, 'Release plan');
  await hideStarter(page, box);
  const before = await camera(page);

  await page.keyboard.press('Control+f');

  const input = find(page);
  await expect(input).toBeFocused();
  await input.fill('RELEASE');

  await expect(frame(page)).toHaveAttribute('x', String(STARTER.x));
  await expect(frame(page)).toHaveAttribute('width', String(STARTER.w));

  const after = await camera(page);
  expect(after).not.toEqual(before);
  expect(after.zoom).toBeLessThanOrEqual(2);

  const topLeft = await onScreen(page, box, STARTER);
  const bottomRight = await onScreen(page, box, {
    x: STARTER.x + STARTER.w,
    y: STARTER.y + STARTER.h,
  });
  expect(topLeft.x).toBeGreaterThanOrEqual(0);
  expect(topLeft.y).toBeGreaterThanOrEqual(0);
  expect(bottomRight.x).toBeLessThanOrEqual(box.width);
  expect(bottomRight.y).toBeLessThanOrEqual(box.height);
});

test('Enter advances to the next match and wraps at the end', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);
  await labelStarter(page, box, 'Plan');
  await placeText(page, box, { x: 520, y: 320 }, 'Plan B');

  await page.keyboard.press('Control+f');
  const input = find(page);
  await input.fill('Plan');

  await expect(frame(page)).toHaveAttribute('x', String(STARTER.x));
  const first = await frame(page).getAttribute('x');

  await input.press('Enter');
  await expect(frame(page)).not.toHaveAttribute('x', first ?? '');

  const second = await frame(page).getAttribute('x');
  await input.press('Enter');
  await expect(frame(page)).toHaveAttribute('x', first ?? '');
  expect(second).not.toBe(first);
});

test('matching is substring and case-insensitive, and a miss leaves the selection and camera alone', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);
  await labelStarter(page, box, 'Deploy checklist');

  await page.keyboard.press('Control+f');
  const input = find(page);
  await input.fill('CHECK');

  await expect(frame(page)).toHaveAttribute('x', String(STARTER.x));
  const selected = await camera(page);

  await input.fill('nothing on this board');

  await expect(frame(page)).toHaveAttribute('x', String(STARTER.x));
  expect(await camera(page)).toEqual(selected);
});

test('searches what a person wrote, not the runs paint derives from it', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);
  await labelStarter(page, box, '**Ship**');

  await page.keyboard.press('Control+f');
  await find(page).fill('**');

  await expect(frame(page)).toHaveAttribute('x', String(STARTER.x));
});

test('Escape closes find, keeps the match selected and gives the keyboard back', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);
  await labelStarter(page, box, 'Plan');

  await page.keyboard.press('Control+f');
  await find(page).fill('plan');
  await expect(frame(page)).toHaveAttribute('x', String(STARTER.x));

  await find(page).press('Escape');

  await expect(find(page)).toBeHidden();
  await expect(frame(page)).toHaveAttribute('x', String(STARTER.x));

  await page.keyboard.press('r');

  await expect(page.getByRole('button', { name: 'Rectangle' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
});

test('Mod+F while the box is focused neither resets it nor leaves the field', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);
  await labelStarter(page, box, 'Plan');

  await page.keyboard.press('Control+f');
  const input = find(page);
  await input.fill('Plan');

  await input.press('Control+f');

  await expect(input).toBeFocused();
  await expect(input).toHaveValue('Plan');
});

test('find reaches a locked shape, because the lock protects geometry and not discovery', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);
  await labelStarter(page, box, 'Plan');

  await page.mouse.click(box.x + 190, box.y + 150);
  await lockToggle(page).click();
  await expect(lockToggle(page)).toHaveText('Unlock');
  await page.mouse.click(box.x + 700, box.y + 450);

  await page.keyboard.press('Control+f');
  await find(page).fill('plan');

  await expect(frame(page)).toHaveAttribute('x', String(STARTER.x));
  await expect(lockToggle(page)).toHaveText('Unlock');
});

test('find selects a group member by its own text, not the group that holds it', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);
  await labelStarter(page, box, 'Plan');

  await page.getByRole('button', { name: 'Rectangle' }).click();
  await page.mouse.move(box.x + 500, box.y + 80);
  await page.mouse.down();
  await page.mouse.move(box.x + 600, box.y + 180);
  await page.mouse.up();

  await page.mouse.click(box.x + 190, box.y + 150);
  await page.keyboard.down('Shift');
  await page.mouse.click(box.x + 550, box.y + 130);
  await page.keyboard.up('Shift');
  await page.keyboard.press('Control+g');

  await page.keyboard.press('Control+f');
  await find(page).fill('plan');

  await expect(frame(page)).toHaveAttribute('x', String(STARTER.x));
  await expect(frame(page)).toHaveAttribute('width', String(STARTER.w));
});
