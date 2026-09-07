import {
	type Diagram,
	type Edge,
	type Frame,
	type Group,
	type Head,
	type Node,
	resolveFrame,
	resolveHead,
} from '@kiyora/dsl';
import { type Box, type LayoutOptions, layoutGraph } from './layout';
import type { Scene, SceneEdge, SceneGroup, SceneNode } from './scene';
import { layoutSequence } from './sequence-layout';

function isHead(value: string | undefined): value is Head {
	return value !== undefined && resolveHead(value) !== null;
}

function isFrame(value: string | undefined): value is Frame {
	return value !== undefined && resolveFrame(value) !== null;
}

function compileNode(node: Node, box: Box): SceneNode {
	return {
		height: box.height,
		id: node.id,
		label: node.label,
		rotation: 0,
		span: node.span,
		width: box.width,
		x: box.x,
		y: box.y,
		...(node.shape === undefined ? {} : { shape: node.shape }),
		...(node.color === undefined ? {} : { color: node.color }),
		...(node.fill === undefined ? {} : { fill: node.fill }),
		...(node.corner === undefined ? {} : { corner: node.corner }),
		...(node.shadow === undefined ? {} : { shadow: node.shadow }),
		...(node.labelColor === undefined ? {} : { labelColor: node.labelColor }),
		...(node.icon === undefined ? {} : { icon: node.icon }),
		...(node.link === undefined ? {} : { link: node.link }),
		...(node.group === undefined ? {} : { group: node.group }),
	};
}

function compileGroup(group: Group): SceneGroup {
	return {
		id: group.id,
		label: group.label,
		span: group.span,
		...(group.color === undefined ? {} : { color: group.color }),
		...(group.icon === undefined ? {} : { icon: group.icon }),
		...(group.parent === undefined ? {} : { parent: group.parent }),
		...(isFrame(group.frame)
			? { frame: resolveFrame(group.frame) ?? undefined }
			: {}),
	};
}

function compileEdge(edge: Edge): SceneEdge {
	return {
		from: edge.from,
		span: edge.span,
		to: edge.to,
		...(edge.label === undefined ? {} : { label: edge.label }),
		...(edge.dashed === undefined ? {} : { dashed: edge.dashed }),
		...(edge.bidirectional === undefined
			? {}
			: { bidirectional: edge.bidirectional }),
		...(edge.color === undefined ? {} : { color: edge.color }),
		...(edge.flow === undefined ? {} : { flow: edge.flow }),
		...(edge.invisible === undefined ? {} : { invisible: edge.invisible }),
		...(edge.back === undefined ? {} : { back: edge.back }),
		...(isHead(edge.head) ? { head: resolveHead(edge.head) ?? undefined } : {}),
	};
}

function activeGroupIds(
	groups: readonly Group[],
	nodes: readonly Node[]
): Set<string> {
	const declared = new Set(groups.map((group) => group.id));
	const active = new Set(
		nodes
			.map((node) => node.group)
			.filter(
				(group): group is string => group !== undefined && declared.has(group)
			)
	);
	let changed = true;
	while (changed) {
		changed = false;
		for (const group of groups) {
			if (
				active.has(group.id) &&
				group.parent !== undefined &&
				declared.has(group.parent) &&
				!active.has(group.parent)
			) {
				active.add(group.parent);
				changed = true;
			}
		}
	}
	return active;
}

/** Compile a graph or sequence Diagram into a deterministic, serializable Scene. */
export function compile(diagram: Diagram, options: LayoutOptions = {}): Scene {
	if (diagram.kind === 'sequence') {
		const { edges, nodes } = layoutSequence(diagram);
		return {
			edges,
			groups: [],
			nodes,
			readOnly: true,
			title: diagram.title,
		};
	}

	const layout = layoutGraph(
		diagram.nodes,
		diagram.edges,
		diagram.direction ?? 'right',
		options
	);

	const nodes: SceneNode[] = [];
	for (const node of diagram.nodes) {
		const box = layout.boxes.get(node.id);
		if (box) {
			nodes.push(compileNode(node, box));
		}
	}
	const nodeIds = new Set(nodes.map((node) => node.id));
	const edges: SceneEdge[] = [];
	for (const edge of diagram.edges) {
		if (nodeIds.has(edge.from) && nodeIds.has(edge.to)) {
			edges.push(compileEdge(edge));
		}
	}
	const activeGroups = activeGroupIds(diagram.groups, diagram.nodes);
	return {
		edges,
		groups: diagram.groups
			.filter((group) => activeGroups.has(group.id))
			.map(compileGroup),
		nodes,
		title: diagram.title,
		...(diagram.direction === undefined
			? {}
			: { direction: diagram.direction }),
		...(diagram.legend === undefined ? {} : { legend: diagram.legend }),
		...(diagram.kind === 'graph' && diagram.variant !== undefined
			? { variant: diagram.variant }
			: {}),
	};
}
