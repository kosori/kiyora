import { describe, expect, test } from 'bun:test';
import { sceneNode } from './testing';

describe('sceneNode fixture builder', () => {
	test('emits a complete rotation-aware node with deterministic defaults', () => {
		expect(sceneNode()).toEqual({
			height: 20,
			id: 'node',
			label: 'node',
			rotation: 0,
			span: { end: { column: 2, line: 1 }, start: { column: 1, line: 1 } },
			width: 20,
			x: 0,
			y: 0,
		});
	});

	test('applies overrides on top of the defaults', () => {
		expect(sceneNode({ id: 'cache', rotation: 90, x: 40 })).toMatchObject({
			height: 20,
			id: 'cache',
			label: 'cache',
			rotation: 90,
			width: 20,
			x: 40,
		});
	});
});
