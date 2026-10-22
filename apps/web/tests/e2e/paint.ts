import { expect, type Locator } from '@playwright/test';

/** The `d` each painted path carries, in paint order. */
export const paintedDs = (paths: Locator): Promise<string[]> =>
  paths.evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute('d') ?? '')
  );

/**
 * Asserts the paths paint exactly these lines, in paint order. The comparison
 * is of paint, not of how many elements happen to carry it.
 */
export const expectPaintedDs = async (
  paths: Locator,
  expected: string[]
): Promise<void> => {
  await expect.poll(() => paintedDs(paths)).toEqual(expected);
};
