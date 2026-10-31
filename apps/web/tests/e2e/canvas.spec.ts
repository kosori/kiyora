import { openStarterBoard } from '../fixtures/library';
import { expect, test } from '../fixtures/offline';

test('the rectangle is painted with its fill and stroke', async ({ page }) => {
  await openStarterBoard(page);

  const rectangle = page.getByTestId('canvas').locator('path').first();

  await expect(rectangle).toHaveAttribute(
    'd',
    'M 80 80 L 300 80 L 300 220 L 80 220 Z'
  );
  await expect(rectangle).toHaveAttribute('fill', '#2f9e44');
  await expect(rectangle).toHaveAttribute('stroke', '#2f9e44');
  await expect(rectangle).toHaveAttribute('stroke-width', '2');
});
