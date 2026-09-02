import { describe, expect, test } from 'bun:test';
import type { Scene, SceneNode } from '@kiyora/render';
import { sceneNode } from '@kiyora/render/testing';
import { selectionToLine } from './selection-to-line';

const span = (line: number) => ({
	end: { column: 2, line },
	start: { column: 1, line },
});

function node(
	id: string,
	line: number,
	extras: Partial<SceneNode> = {}
): SceneNode {
	return sceneNode({
		height: 40,
		id,
		label: id,
		span: span(line),
		width: 80,
		...extras,
	});
}

function scene(nodes: SceneNode[]): Scene {
	return { edges: [], groups: [], nodes, title: '' };
}

describe('selectionToLine', () => {
	test('returns null when the selection is empty', () => {
		expect(selectionToLine(scene([node('a', 1)]), [])).toBeNull();
	});

	test('returns the 1-based start line of the first selected node', () => {
		expect(selectionToLine(scene([node('a', 4)]), ['a'])).toBe(4);
	});

	test('returns null when the selected id is not in the scene', () => {
		expect(selectionToLine(scene([node('a', 1)]), ['missing'])).toBeNull();
	});

	test('uses the first selection id when many are selected', () => {
		const sceneData = scene([node('a', 3), node('b', 12)]);
		expect(selectionToLine(sceneData, ['b', 'a'])).toBe(12);
	});
});
