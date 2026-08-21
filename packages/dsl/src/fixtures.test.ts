import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parse } from './index';

const FIXTURES = join(import.meta.dir, '..', 'test', 'fixtures');

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
