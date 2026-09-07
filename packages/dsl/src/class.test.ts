import { describe, expect, test } from 'bun:test';
import { parseClass } from './class';

describe('parseClass', () => {
	test('parses visibility modifiers with and without spaces', () => {
		const source = `class
User {
  + id int pk
  +name string
  - passwordHash string
  # secretToken string
  ~ internalFlag bool
  ---
  + getEmail() string
  -hashPassword()
}
`;
		const result = parseClass(source);
		expect(result.diagnostics).toEqual([]);
		expect(result.diagram.kind).toBe('class');
		if (result.diagram.kind !== 'class') {
			return;
		}

		const [entity] = result.diagram.entities;
		expect(entity?.label).toBe('User');
		expect(entity?.fields).toEqual([
			{ key: 'pk', name: 'id', type: 'int', visibility: 'public' },
			{ name: 'name', type: 'string', visibility: 'public' },
			{ name: 'passwordHash', type: 'string', visibility: 'private' },
			{ name: 'secretToken', type: 'string', visibility: 'protected' },
			{ name: 'internalFlag', type: 'bool', visibility: 'package' },
		]);
		expect(entity?.methods).toEqual([
			{ name: 'getEmail()', type: 'string', visibility: 'public' },
			{ name: 'hashPassword()', visibility: 'private' },
		]);
	});
});
