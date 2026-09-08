import type { MindMapDiagram } from '@kiyora/dsl';
import { type LayoutOptions, measureNode } from './layout';
import type { SceneEdge, SceneNode } from './scene';

/** Lay out a mindmap diagram. */
export function layoutMindmap(
	diagram: MindMapDiagram,
	options: LayoutOptions = {}
): {
	edges: SceneEdge[];
	nodes: SceneNode[];
} {
	const { root } = diagram;
	const { height, width } = measureNode(
		{
			id: root.id,
			label: root.label,
			span: root.span,
		},
		options
	);

	const rootNode: SceneNode = {
		corner: 'rounded',
		height,
		id: root.id,
		label: root.label,
		rotation: 0,
		shape: 'rectangle',
		span: root.span,
		width,
		x: 0,
		y: 0,
		...(root.color === undefined ? {} : { color: root.color }),
		...(root.fill === undefined ? {} : { fill: root.fill }),
	};

	return {
		edges: [],
		nodes: [rootNode],
	};
}
