import { describe, expect, test } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse } from './index';

const FIXTURES = fileURLToPath(
	new URL('../test/fixtures', import.meta.url)
);

const names = readdirSync(FIXTURES)
	.filter((f) => f.endsWith('.kira'))
	.map((f) => f.replace(/\.kira$/, ''));

describe('fixtures', () => {
	for (const name of names) {
		test(name, () => {
			const source = readFileSync(join(FIXTURES, `${name}.kira`), 'utf8');
			const expected = JSON.parse(
				readFileSync(join(FIXTURES, `${name}.json`), 'utf8')
			);
			expect(parse(source)).toEqual(expected);
		});
	}
});
