import type { Diagram } from '@kiyora/dsl';
import type { Scene } from './scene';

export type { Box, Point } from './geometry';
// The package entrypoint intentionally re-exports pure modules for consumers.
// biome-ignore lint/performance/noBarrelFile: this is the public package entrypoint.
export { edgePathD, intersectRect } from './geometry';
export type { LabelMeasureOptions, LabelMetrics } from './label';
export { measureLabel, measureLabelWidth, wrapLabel } from './label';
export type { Scene, SceneEdge, SceneGroup, SceneNode } from './scene';
export type { ShapeKind } from './shapes';
export { FALLBACK_SHAPES, renderShape, roundedRectPath } from './shapes';
export type {
	FillStyle,
	PaletteColor,
	ResolvedFill,
	Style,
} from './style';
export {
	COLORS,
	cornerRadius,
	dashAttrs,
	EDGE_FONT_SIZE,
	EDGE_STROKE,
	edgeColor,
	FONT_CODE,
	FONT_HAND,
	INK,
	NODE_FONT_SIZE,
	NODE_STROKE,
	PALETTE,
	resolveStyle,
	TEXT_PADDING,
	textColorFor,
	WHITE,
} from './style';
/** Options for the static SVG projection. */
export type RenderOptions = {
	edgeFontSize?: number;
	fontFamily?: string;
	height?: number;
	nodeFontSize?: number;
	padding?: number;
	width?: number;
};

/** The result of projecting a scene to SVG. */
export type RenderResult = {
	height: number;
	svg: string;
	width: number;
};

/**
 * Compile a graph diagram into the empty scene scaffold.
 *
 * Layout and scene assembly are introduced by the subsequent render package
 * increments. Keeping the diagram chrome here makes the scaffold useful to
 * consumers without inventing positions for content it cannot yet render.
 */
export function compile(diagram: Diagram): Scene {
	return {
		edges: [],
		groups: [],
		nodes: [],
		title: diagram.title,
		...(diagram.direction === undefined
			? {}
			: { direction: diagram.direction }),
		...(diagram.legend === undefined ? {} : { legend: diagram.legend }),
	};
}

const DEFAULT_PADDING = 24;
const DEFAULT_FONT_FAMILY = 'Balsamiq Sans Neue, cursive';
const DEFAULT_NODE_FONT_SIZE = 16;
const DEFAULT_EDGE_FONT_SIZE = 13;

function getContentBounds(scene: Scene): {
	maxX: number;
	maxY: number;
	minX: number;
	minY: number;
} {
	if (scene.nodes.length === 0) {
		return { maxX: 0, maxY: 0, minX: 0, minY: 0 };
	}

	const [firstNode] = scene.nodes;
	if (!firstNode) {
		return { maxX: 0, maxY: 0, minX: 0, minY: 0 };
	}

	let minX = firstNode.x;
	let minY = firstNode.y;
	let maxX = firstNode.x + firstNode.width;
	let maxY = firstNode.y + firstNode.height;

	for (const node of scene.nodes.slice(1)) {
		minX = Math.min(minX, node.x);
		minY = Math.min(minY, node.y);
		maxX = Math.max(maxX, node.x + node.width);
		maxY = Math.max(maxY, node.y + node.height);
	}

	return { maxX, maxY, minX, minY };
}

function escapeAttribute(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('"', '&quot;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;');
}

/** Project a scene to a minimal, valid static SVG document. */
export function renderToSvg(
	scene: Scene,
	options: RenderOptions = {}
): RenderResult {
	const padding = options.padding ?? DEFAULT_PADDING;
	const bounds = getContentBounds(scene);
	const computedWidth = Math.max(0, bounds.maxX - bounds.minX) + padding * 2;
	const computedHeight = Math.max(0, bounds.maxY - bounds.minY) + padding * 2;
	const width = options.width ?? computedWidth;
	const height = options.height ?? computedHeight;
	const fontFamily = escapeAttribute(options.fontFamily ?? DEFAULT_FONT_FAMILY);
	const title = scene.title
		? `<title>${escapeAttribute(scene.title)}</title>`
		: '';
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="${fontFamily}" data-node-font-size="${options.nodeFontSize ?? DEFAULT_NODE_FONT_SIZE}" data-edge-font-size="${options.edgeFontSize ?? DEFAULT_EDGE_FONT_SIZE}">${title}</svg>`;

	return { height, svg, width };
}

/** Compile a diagram and project the result to SVG. */
export function render(
	diagram: Diagram,
	options?: RenderOptions
): RenderResult {
	return renderToSvg(compile(diagram), options);
}
