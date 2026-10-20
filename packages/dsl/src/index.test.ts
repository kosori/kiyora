import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);

describe('@kiyora/dsl', () => {
  it('resolves to TypeScript source, with no build step in between', () => {
    expect(require.resolve('@kiyora/dsl')).toBe(
      fileURLToPath(new URL('./index.ts', import.meta.url))
    );
  });
});
