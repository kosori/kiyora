import type { Span } from '@kiyora/dsl';
import type { SceneNode } from './scene';

const DEFAULT_SPAN: Span = {
	end: { column: 2, line: 1 },
	start: { column: 1, line: 1 },
};

/**
 * Build a complete Scene node for tests, with `rotation: 0` and sensible
 * defaults so every new test produces rotation-complete nodes.
 */
export function sceneNode(overrides: Partial<SceneNode> = {}): SceneNode {
	const id = overrides.id ?? 'node';
	return {
		height: 20,
		id,
		label: overrides.label ?? id,
		rotation: 0,
		span: DEFAULT_SPAN,
		width: 20,
		x: 0,
		y: 0,
		...overrides,
	};
}
