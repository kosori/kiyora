import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

/**
 * The accessibility sweep, at the browser seam like every other capability.
 * axe reads the rendered document — accessible names, roles, contrast, headings
 * and focusable scroll regions — so a unit test that cannot see a name cannot
 * stand in for it. Each screen the app has is audited, and the keyboard is
 * driven for real: an action that only a pointer can reach fails here.
 */

/** Wait for the surface to say it can act, so paint is on screen before a gesture. */
const open = async (page: Page): Promise<void> => {
  await page.goto('/');
  await expect(page.getByTestId('canvas')).toHaveAttribute(
    'data-ready',
    'true'
  );
};

/** The deck is a tab in the right rail; open it before reaching for a slide. */
const openDeck = async (page: Page): Promise<void> => {
  await page.getByTestId('rail-tab-deck').click();
};

/** The canvas's place on the screen, so board coordinates can be clicked exactly. */
const canvasBox = async (page: Page) => {
  const box = await page.getByTestId('canvas').boundingBox();

  if (box === null) {
    throw new Error('the canvas has no box');
  }

  return box;
};

/** The starter board's rectangle, which paints first. */
const starterShape = (page: Page) =>
  page.getByTestId('board').locator('path').first();

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

/** Draw a second rectangle, then join the two with a connector. */
const joinTwoShapes = async (
  page: Page,
  box: { x: number; y: number }
): Promise<void> => {
  await page.keyboard.press('r');
  await drag(
    page,
    { x: box.x + 500, y: box.y + 80 },
    { x: box.x + 600, y: box.y + 180 }
  );
  await page.keyboard.press('c');
  await drag(
    page,
    { x: box.x + 200, y: box.y + 150 },
    { x: box.x + 550, y: box.y + 130 }
  );
};

/** Every violation axe reports on the current screen, named so a failure reads. */
const audit = async (page: Page): Promise<string[]> => {
  const results = await new AxeBuilder({ page }).analyze();

  return results.violations.map(
    (violation) =>
      `${violation.id} [${violation.impact ?? 'unknown'}] -> ${violation.nodes
        .map((node) => node.target.join(' '))
        .join(' | ')}`
  );
};

/** The focused control's name and whether it paints a visible indicator, or `null` at the page. */
const focusedStop = (page: Page) =>
  page.evaluate(() => {
    const active = document.activeElement as HTMLElement | null;
    if (active === null || active === document.body) {
      return null;
    }
    // The Next dev tools badge is dev-only chrome, not the app: it ships in no
    // production build and paints no focus style of its own.
    if (active.tagName === 'NEXTJS-PORTAL') {
      return { label: active.tagName, visible: true };
    }
    const style = getComputedStyle(active);
    return {
      label:
        active.getAttribute('data-testid') ??
        active.getAttribute('aria-label') ??
        active.tagName,
      visible: style.outlineStyle !== 'none' || style.boxShadow !== 'none',
    };
  });

/** Tabs through the page, naming every stop that paints no visible indicator. */
const sweepFocusStops = async (
  page: Page,
  remaining: number
): Promise<string[]> => {
  if (remaining <= 0) {
    return [];
  }
  await page.keyboard.press('Tab');
  const stop = await focusedStop(page);
  if (stop === null) {
    return [];
  }
  const rest = await sweepFocusStops(page, remaining - 1);

  return stop.visible ? rest : [stop.label, ...rest];
};

test('the editor with nothing selected reports no accessibility violations', async ({
  page,
}) => {
  await open(page);

  expect(await audit(page)).toEqual([]);
});

test('the editor with a shape selected reports no accessibility violations', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);
  await page.mouse.click(box.x + 150, box.y + 150);

  await expect(page.getByTestId('inspector-empty')).toHaveCount(0);
  expect(await audit(page)).toEqual([]);
});

test('the label editor reports no accessibility violations', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);
  await page.keyboard.press('t');
  await page.mouse.click(box.x + 300, box.y + 220);
  await expect(page.getByTestId('text-editor')).toBeVisible();

  expect(await audit(page)).toEqual([]);
});

test('the shape picker reports no accessibility violations', async ({
  page,
}) => {
  await open(page);
  await page.getByTestId('shape-picker').click();
  await expect(page.getByTestId('shape-picker-menu')).toBeVisible();

  expect(await audit(page)).toEqual([]);
});

test('a selected connector reports no accessibility violations', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);
  await joinTwoShapes(page, box);

  await page.mouse.click(box.x + 400, box.y + 140);
  await expect(page.getByTestId('connector-controls')).toBeVisible();

  expect(await audit(page)).toEqual([]);
});

test('the shortcut dialog reports no accessibility violations', async ({
  page,
}) => {
  await open(page);
  await page.keyboard.press('?');
  await expect(
    page.getByRole('dialog', { name: 'Keyboard shortcuts' })
  ).toBeVisible();

  expect(await audit(page)).toEqual([]);
});

test('the deck with a slide reports no accessibility violations', async ({
  page,
}) => {
  await open(page);
  await openDeck(page);
  await page.getByTestId('template-title').click();
  await expect(page.getByTestId('slide')).toBeVisible();

  expect(await audit(page)).toEqual([]);
});

test('the present overlay reports no accessibility violations', async ({
  page,
}) => {
  await open(page);
  await openDeck(page);
  await page.getByTestId('template-title').click();
  await page.getByTestId('present-button').click();
  await expect(page.getByTestId('present-overlay')).toBeVisible();

  expect(await audit(page)).toEqual([]);
});

test('a storage fault reports no accessibility violations', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', {
      configurable: true,
      value: undefined,
    });
    localStorage.setItem('kiyora:board', 'this is not a board');
  });
  await open(page);
  await expect(page.getByTestId('save-status')).toHaveAttribute(
    'data-fault',
    'corrupt'
  );

  expect(await audit(page)).toEqual([]);
});

test('a failed panel reports no accessibility violations', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('kiyora:test:crash-panel:tools', '1');
  });
  await open(page);
  await expect(page.getByTestId('panel-error')).toBeVisible();

  expect(await audit(page)).toEqual([]);
});

test('every rail tool is selectable from the keyboard', async ({ page }) => {
  await open(page);
  const rail = page.getByRole('toolbar', { name: 'Tools' });

  /** Focus one tool like a hand on the keys and press it. */
  const press = async (name: string): Promise<void> => {
    const button = rail.getByRole('button', { name });
    await button.focus();
    await page.keyboard.press('Enter');
    await expect(button).toHaveAttribute('aria-pressed', 'true');
  };

  await press('Select');
  await press('Rectangle');
  await press('Text');
  await press('Connector');
  await press('Sticky');
  await press('Frame');
});

test('the shape picker opens and chooses from the keyboard', async ({
  page,
}) => {
  await open(page);
  const picker = page.getByTestId('shape-picker');

  await picker.focus();
  await page.keyboard.press('Enter');
  await expect(picker).toHaveAttribute('aria-expanded', 'true');

  const diamond = page.getByRole('menuitem', { name: 'Diamond' });
  await diamond.focus();
  await page.keyboard.press('Enter');

  await expect(picker).toHaveAttribute('aria-expanded', 'false');
  await expect(picker).toHaveAttribute('aria-pressed', 'true');
});

test('the inspector repaints from the keyboard', async ({ page }) => {
  await open(page);
  const box = await canvasBox(page);
  await page.mouse.click(box.x + 150, box.y + 150);

  const fill = page.getByTestId('fill-blue');
  await fill.focus();
  await page.keyboard.press('Enter');
  await expect(starterShape(page)).toHaveAttribute('fill', '#1971c2');

  const dash = page.getByTestId('dash-dashed');
  await dash.focus();
  await page.keyboard.press('Enter');
  await expect(starterShape(page)).toHaveAttribute('stroke-dasharray', '8 6');
});

test('the deck builds and presents a slide from the keyboard', async ({
  page,
}) => {
  await open(page);
  await openDeck(page);

  const template = page.getByTestId('template-title');
  await template.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('slide')).toHaveAttribute(
    'data-frame-id',
    'frame-1'
  );

  const present = page.getByTestId('present-button');
  await present.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('present-overlay')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.getByTestId('present-overlay')).toBeHidden();
});

test('the shortcut dialog closes and leaves the editor operable', async ({
  page,
}) => {
  await open(page);
  await page.keyboard.press('?');

  const dialog = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
  await expect(dialog).toBeVisible();
  expect(
    await page.evaluate(
      () => document.activeElement?.closest('dialog') !== null
    )
  ).toBe(true);

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  await page.keyboard.press('r');
  await expect(page.getByRole('button', { name: 'Rectangle' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
});

test('presenting takes focus, keeps it inside, and gives it back on exit', async ({
  page,
}) => {
  await open(page);
  await openDeck(page);
  await page.getByTestId('template-title').click();

  const present = page.getByTestId('present-button');
  await present.click();

  const overlay = page.getByTestId('present-overlay');
  await expect(overlay).toBeVisible();

  const inside = () =>
    page.evaluate(
      () =>
        document.activeElement !== null &&
        document
          .querySelector('[data-testid="present-overlay"]')
          ?.contains(document.activeElement) === true
    );

  await expect.poll(inside).toBe(true);
  await page.keyboard.press('Tab');
  expect(await inside()).toBe(true);

  await page.keyboard.press('Escape');
  await expect(overlay).toBeHidden();
  await expect
    .poll(() =>
      page.evaluate(() => document.activeElement?.getAttribute('data-testid'))
    )
    .toBe('present-button');
});

test('the skip link takes focus, shows itself, and moves focus to the board', async ({
  page,
}) => {
  await open(page);
  const skip = page.getByRole('link', { name: 'Skip to board' });

  expect((await skip.boundingBox())?.width ?? 0).toBeLessThanOrEqual(1);

  await page.keyboard.press('Tab');
  await expect(skip).toBeFocused();
  expect((await skip.boundingBox())?.width ?? 0).toBeGreaterThan(40);

  await page.keyboard.press('Enter');
  await expect(page.getByTestId('canvas')).toBeFocused();
});

test('the tool rail and the panels are landmarks with reachable controls', async ({
  page,
}) => {
  await open(page);
  const tools = page.getByRole('navigation', { name: 'Board tools' });
  await expect(tools).toBeVisible();
  await expect(tools.getByRole('toolbar', { name: 'Tools' })).toBeVisible();

  const panels = page.getByRole('complementary', { name: 'Panels' });
  await expect(panels).toBeVisible();
  const tabs = panels.getByRole('tablist', { name: 'Panel sections' });
  await expect(tabs).toBeVisible();

  const deck = tabs.getByRole('tab', { name: 'Deck' });
  await deck.focus();
  await page.keyboard.press('Enter');
  await expect(panels.getByRole('tabpanel', { name: 'Deck' })).toBeVisible();
});

test('the live region announces the selection a gesture makes', async ({
  page,
}) => {
  await open(page);
  const announcer = page.getByTestId('selection-announcer');
  await expect(announcer).toHaveText('Nothing selected');

  const box = await canvasBox(page);
  await page.mouse.click(box.x + 150, box.y + 150);
  await expect(announcer).toHaveText('Rectangle selected');

  await page.mouse.click(box.x + 400, box.y + 300);
  await expect(announcer).toHaveText('Nothing selected');
});

test('every focus stop paints a visible indicator', async ({ page }) => {
  await open(page);
  const box = await canvasBox(page);
  await page.mouse.click(box.x + 150, box.y + 150);

  expect(await sweepFocusStops(page, 80)).toEqual([]);
});
