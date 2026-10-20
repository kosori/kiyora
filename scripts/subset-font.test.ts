import { readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { WEIGHTS } from './subset-font';

const fonts = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'apps',
  'web',
  'public',
  'fonts'
);

const files = readdirSync(fonts);

describe('the committed font subsets', () => {
  it('are exactly the faces the subset script can reproduce', () => {
    expect(files.filter((file) => file.endsWith('.woff2')).sort()).toEqual(
      WEIGHTS.map((weight) => weight.output).sort()
    );
  });

  it('ship the licence text for each face beside the bytes', () => {
    expect(files.filter((file) => file.startsWith('OFL-')).sort()).toEqual([
      'OFL-BalsamiqSansNeue.txt',
      'OFL-GeistMono.txt',
    ]);
  });
});
