import type { Scene, SceneEdge, SceneGroup, SceneNode } from '@kiyora/render';
import { COLORS } from '@kiyora/render';
import { type Box, edgePathD, intersectRect } from '@kiyora/render/geometry';
import { measureLabel, measureLabelWidth } from '@kiyora/render/label';
import { renderShape } from '@kiyora/render/shapes';
import {
	cornerRadius,
	dashAttrs,
	EDGE_FONT_SIZE,
	EDGE_STROKE,
	edgeColor,
	FONT_HAND,
	INK,
	NODE_FONT_SIZE,
	NODE_STROKE,
	resolveStyle,
	TEXT_PADDING,
} from '@kiyora/render/style';
import type { EditorSnapshot } from './editor';
import { worldToScreen } from './viewport';

/** Options for the canvas SVG projection. */
export type RenderSceneOptions = {
	contentOffset?: { x: number; y: number };
	edgeFontSize?: number;
	fontFamily?: string;
	height?: number;
	nodeFontSize?: number;
	padding?: number;
	showGrid?: boolean;
	width?: number;
};

type Bounds = { maxX: number; maxY: number; minX: number; minY: number };
type GroupBox = Box;

const DEFAULT_PADDING = 24;
const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 600;
const GROUP_PADDING = 30;
const GROUP_STROKE = 1.5;
const GROUP_FONT_SIZE = 13;
const TITLE_HEIGHT = 30;
const LEGEND_HEIGHT = 30;
const GRID_SPACING = 24;
const GRID_COLOR = '#c8cdd4';
const BACKGROUND_COLOR = '#fbfcfe';
const SELECTION_COLOR = '#4dabf7';

const MARKERS =
	'<marker id="kiyora-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke" stroke="context-stroke" stroke-width="1"/></marker><marker id="kiyora-circle" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto"><circle cx="5" cy="5" r="3" fill="context-stroke"/></marker><marker id="kiyora-cross" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M 2 2 L 8 8 M 8 2 L 2 8" fill="none" stroke="context-stroke" stroke-width="2" stroke-linecap="round"/></marker><marker id="kiyora-arrow-reverse" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M 10 0 L 0 5 L 10 10 z" fill="context-stroke" stroke="context-stroke" stroke-width="1"/></marker><marker id="kiyora-circle-reverse" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto"><circle cx="5" cy="5" r="3" fill="context-stroke"/></marker><marker id="kiyora-cross-reverse" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M 2 2 L 8 8 M 8 2 L 2 8" fill="none" stroke="context-stroke" stroke-width="2" stroke-linecap="round"/></marker>';
const EFFECTS =
	'<filter id="kiyora-shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000000" flood-opacity="0.12"/></filter>';

function escapeText(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;');
}

function boxForNode(node: SceneNode): Box {
	return { height: node.height, width: node.width, x: node.x, y: node.y };
}

function unionBounds(bounds: Bounds, box: Box): Bounds {
	return {
		maxX: Math.max(bounds.maxX, box.x + box.width),
		maxY: Math.max(bounds.maxY, box.y + box.height),
		minX: Math.min(bounds.minX, box.x),
		minY: Math.min(bounds.minY, box.y),
	};
}

function contentBounds(
	scene: Scene,
	groupBoxes: Map<string, GroupBox>
): Bounds {
	let bounds: Bounds | undefined;
	for (const node of scene.nodes) {
		const box = boxForNode(node);
		bounds = bounds
			? unionBounds(bounds, box)
			: {
					maxX: box.x + box.width,
					maxY: box.y + box.height,
					minX: box.x,
					minY: box.y,
				};
	}
	for (const group of scene.groups) {
		const box = groupBoxes.get(group.id);
		if (!box) {
			continue;
		}
		bounds = bounds
			? unionBounds(bounds, box)
			: {
					maxX: box.x + box.width,
					maxY: box.y + box.height,
					minX: box.x,
					minY: box.y,
				};
		bounds = unionBounds(bounds, {
			height: GROUP_FONT_SIZE,
			width: measureLabelWidth(group.label, GROUP_FONT_SIZE),
			x: box.x + 14,
			y: box.y + 4,
		});
	}
	return bounds ?? { maxX: 0, maxY: 0, minX: 0, minY: 0 };
}

function deriveGroupBoxes(scene: Scene): Map<string, GroupBox> {
	const groups = new Map(scene.groups.map((group) => [group.id, group]));
	const nodesByGroup = new Map<string, SceneNode[]>();
	for (const node of scene.nodes) {
		if (node.group === undefined) {
			continue;
		}
		const members = nodesByGroup.get(node.group) ?? [];
		members.push(node);
		nodesByGroup.set(node.group, members);
	}
	const childrenByParent = new Map<string, SceneGroup[]>();
	for (const group of scene.groups) {
		if (group.parent === undefined) {
			continue;
		}
		const children = childrenByParent.get(group.parent) ?? [];
		children.push(group);
		childrenByParent.set(group.parent, children);
	}
	const boxes = new Map<string, GroupBox>();
	const resolving = new Set<string>();
	const resolve = (id: string): GroupBox | undefined => {
		const known = boxes.get(id);
		if (known) {
			return known;
		}
		if (resolving.has(id)) {
			return undefined;
		}
		const group = groups.get(id);
		if (!group) {
			return undefined;
		}
		resolving.add(id);
		let bounds: Bounds | undefined;
		for (const node of nodesByGroup.get(id) ?? []) {
			const box = boxForNode(node);
			bounds = bounds
				? unionBounds(bounds, box)
				: {
						maxX: box.x + box.width,
						maxY: box.y + box.height,
						minX: box.x,
						minY: box.y,
					};
		}
		for (const child of childrenByParent.get(id) ?? []) {
			const childBox = resolve(child.id);
			if (childBox) {
				bounds = bounds
					? unionBounds(bounds, childBox)
					: {
							maxX: childBox.x + childBox.width,
							maxY: childBox.y + childBox.height,
							minX: childBox.x,
							minY: childBox.y,
						};
			}
		}
		resolving.delete(id);
		if (!bounds) {
			return undefined;
		}
		const box = {
			height: bounds.maxY - bounds.minY + GROUP_PADDING * 2,
			width: bounds.maxX - bounds.minX + GROUP_PADDING * 2,
			x: bounds.minX - GROUP_PADDING,
			y: bounds.minY - GROUP_PADDING,
		};
		boxes.set(id, box);
		return box;
	};
	for (const group of scene.groups) {
		resolve(group.id);
	}
	return boxes;
}

function groupMarkup(group: SceneGroup, box: GroupBox): string {
	const color = edgeColor(group.color ?? 'gray');
	const radius = cornerRadius(box.width, box.height);
	return `<g data-group="${escapeText(group.id)}"><rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" rx="${radius}" fill="none" stroke="${color}" stroke-width="${GROUP_STROKE}" stroke-dasharray="6 6" stroke-linecap="round"/><text x="${box.x + 14}" y="${box.y + 18}" text-anchor="start" font-size="${GROUP_FONT_SIZE}" fill="${color}">${escapeText(group.label)}</text></g>`;
}

function edgeMarkup(
	edge: SceneEdge,
	nodes: Map<string, SceneNode>,
	edgeFontSize: number
): string {
	const from = nodes.get(edge.from);
	const to = nodes.get(edge.to);
	if (!(from && to) || edge.invisible) {
		return '';
	}
	const fromBox = boxForNode(from);
	const toBox = boxForNode(to);
	const d = edgePathD(fromBox, toBox);
	const start = intersectRect(fromBox, {
		x: to.x + to.width / 2,
		y: to.y + to.height / 2,
	});
	const end = intersectRect(toBox, {
		x: from.x + from.width / 2,
		y: from.y + from.height / 2,
	});
	const color = edgeColor(edge.color);
	const head = edge.head ?? 'arrow';
	const dash = dashAttrs(edge.dashed ? 'dashed' : 'solid', EDGE_STROKE);
	const markerStart = edge.bidirectional
		? ` marker-start="url(#kiyora-${head}-reverse)"`
		: '';
	const markerEnd = ` marker-end="url(#kiyora-${head})"`;
	const label =
		edge.label === undefined
			? ''
			: `<text x="${(start.x + end.x) / 2}" y="${(start.y + end.y) / 2}" text-anchor="middle" dominant-baseline="middle" font-size="${edgeFontSize}" fill="${INK}" stroke="#ffffff" stroke-width="4" paint-order="stroke">${escapeText(edge.label)}</text>`;
	return `<g data-edge="${escapeText(`${edge.from}-${edge.to}`)}"><path d="${d}" fill="none" stroke="${color}" stroke-width="${EDGE_STROKE}" stroke-linecap="${dash.strokeLinecap}"${dash.strokeDasharray ? ` stroke-dasharray="${dash.strokeDasharray}"` : ''}${markerStart}${markerEnd}/>${label}</g>`;
}

function nodeMarkup(node: SceneNode, fontSize: number): string {
	const style = resolveStyle(node.color ?? 'gray', node.fill ?? 'pastel');
	const box = boxForNode(node);
	const shape = renderShape(
		node.shape ?? 'rectangle',
		box,
		style,
		NODE_STROKE,
		node.corner
	);
	const textColor = node.labelColor ? edgeColor(node.labelColor) : style.text;
	const metrics = measureLabel(node.label, {
		fontSize,
		maxWidth: Math.max(1, box.width - TEXT_PADDING * 2),
		verticalPadding: TEXT_PADDING * 2,
	});
	const firstY =
		box.y +
		box.height / 2 -
		((metrics.lines.length - 1) * metrics.lineHeight) / 2;
	const labels = metrics.lines
		.map(
			(line, index) =>
				`<text x="${box.x + box.width / 2}" y="${firstY + index * metrics.lineHeight}" text-anchor="middle" dominant-baseline="middle" font-size="${fontSize}" fill="${textColor}">${escapeText(line)}</text>`
		)
		.join('');
	const filter = node.shadow ? ' filter="url(#kiyora-shadow)"' : '';
	return `<g data-node="${escapeText(node.id)}"${filter}>${shape}${labels}</g>`;
}

function isPaletteColor(value: string): boolean {
	return COLORS.some((color) => color === value);
}

function safeLegendColor(swatch: string): string {
	return isPaletteColor(swatch) ? edgeColor(swatch) : INK;
}

function legendWidth(scene: Scene): number {
	return (scene.legend ?? []).reduce(
		(total, entry) => total + 24 + measureLabelWidth(entry.label, 12) + 24,
		0
	);
}

function legendMarkup(scene: Scene, y: number, padding: number): string {
	if (!scene.legend || scene.legend.length === 0) {
		return '';
	}
	let x = padding;
	const swatches = scene.legend
		.map((entry) => {
			const color = safeLegendColor(entry.swatch);
			const markup = `<g><rect x="${x}" y="${y - 10}" width="12" height="12" rx="2" fill="${color}"/><text x="${x + 18}" y="${y}" font-size="12" fill="${INK}">${escapeText(entry.label)}</text></g>`;
			x += 24 + measureLabelWidth(entry.label, 12) + 24;
			return markup;
		})
		.join('');
	return `<g data-legend="true">${swatches}</g>`;
}

function renderGrid(
	viewport: EditorSnapshot['viewport'],
	width: number,
	height: number
): string {
	const gap = GRID_SPACING * viewport.zoom;
	const dx = viewport.tx % gap;
	const dy = viewport.ty % gap;
	const dots: string[] = [];
	if (gap > 0 && Number.isFinite(gap)) {
		for (let x = dx; x < width; x += gap) {
			for (let y = dy; y < height; y += gap) {
				dots.push(
					`<circle cx="${x}" cy="${y}" r="${Math.max(0.5, viewport.zoom * 0.6)}" fill="${GRID_COLOR}"/>`
				);
			}
		}
	}
	return `<rect width="${width}" height="${height}" fill="${BACKGROUND_COLOR}"/><g>${dots.join('')}</g>`;
}

function selectionMarkup(
	snapshot: EditorSnapshot,
	nodeIndex: Map<string, SceneNode>,
	contentOffset: { x: number; y: number }
): string {
	return snapshot.selection
		.map((id) => {
			const node = nodeIndex.get(id);
			if (!node) {
				return '';
			}
			const topLeft = worldToScreen(snapshot.viewport, {
				x: node.x + contentOffset.x,
				y: node.y + contentOffset.y,
			});
			const bottomRight = worldToScreen(snapshot.viewport, {
				x: node.x + node.width + contentOffset.x,
				y: node.y + node.height + contentOffset.y,
			});
			const width = bottomRight.x - topLeft.x;
			const height = bottomRight.y - topLeft.y;
			const radius = Math.max(
				4,
				cornerRadius(node.width, node.height) * snapshot.viewport.zoom
			);
			return `<rect x="${topLeft.x - 3}" y="${topLeft.y - 3}" width="${width + 6}" height="${height + 6}" rx="${radius}" fill="none" stroke="${SELECTION_COLOR}" stroke-width="1.5" stroke-dasharray="4 3"/>`;
		})
		.join('');
}

/** Return the world-space offset used to keep scene content inside the SVG. */
export function contentOffsetForScene(
	snapshot: EditorSnapshot,
	padding = DEFAULT_PADDING
): { x: number; y: number } {
	const groupBoxes = deriveGroupBoxes(snapshot.scene);
	const bounds = contentBounds(snapshot.scene, groupBoxes);
	return {
		x: padding - bounds.minX,
		y:
			padding +
			(snapshot.scene.title.length > 0 ? TITLE_HEIGHT : 0) -
			bounds.minY,
	};
}

/** Project an Editor snapshot into a complete, interactive-canvas SVG string. */
export function renderScene(
	snapshot: EditorSnapshot,
	options: RenderSceneOptions = {}
): string {
	const padding = options.padding ?? DEFAULT_PADDING;
	const nodeFontSize = options.nodeFontSize ?? NODE_FONT_SIZE;
	const edgeFontSize = options.edgeFontSize ?? EDGE_FONT_SIZE;
	const groupBoxes = deriveGroupBoxes(snapshot.scene);
	const bounds = contentBounds(snapshot.scene, groupBoxes);
	const contentWidth = Math.max(0, bounds.maxX - bounds.minX);
	const contentHeight = Math.max(0, bounds.maxY - bounds.minY);
	const hasTitle = snapshot.scene.title.length > 0;
	const hasLegend = (snapshot.scene.legend?.length ?? 0) > 0;
	const computedWidth = Math.max(
		DEFAULT_WIDTH,
		contentWidth + padding * 2,
		hasTitle ? measureLabelWidth(snapshot.scene.title, 18) + padding * 2 : 0,
		hasLegend ? legendWidth(snapshot.scene) + padding : 0
	);
	const computedHeight = Math.max(
		DEFAULT_HEIGHT,
		contentHeight +
			padding * 2 +
			(hasTitle ? TITLE_HEIGHT : 0) +
			(hasLegend ? LEGEND_HEIGHT : 0)
	);
	const width = options.width ?? computedWidth;
	const height = options.height ?? computedHeight;
	const fontFamily = escapeText(options.fontFamily ?? FONT_HAND);
	const contentOffsetX = options.contentOffset?.x ?? padding - bounds.minX;
	const contentOffsetY =
		options.contentOffset?.y ??
		padding + (hasTitle ? TITLE_HEIGHT : 0) - bounds.minY;
	const nodeIndex = new Map(
		snapshot.scene.nodes.map((node) => [node.id, node])
	);
	const parts: string[] = [
		`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="touch-action:none;user-select:none" font-family="${fontFamily}"><defs>${MARKERS}${EFFECTS}</defs>`,
	];
	if (options.showGrid === false) {
		parts.push(
			`<rect width="${width}" height="${height}" fill="${BACKGROUND_COLOR}"/>`
		);
	} else {
		parts.push(renderGrid(snapshot.viewport, width, height));
	}
	parts.push(
		`<g transform="translate(${snapshot.viewport.tx} ${snapshot.viewport.ty}) scale(${snapshot.viewport.zoom})" font-family="${fontFamily}">`
	);
	parts.push(`<g transform="translate(${contentOffsetX} ${contentOffsetY})">`);
	if (hasTitle) {
		parts.push(
			`<text x="${padding - contentOffsetX}" y="${padding + 18 - contentOffsetY}" text-anchor="start" font-size="18" font-weight="600" fill="${INK}">${escapeText(snapshot.scene.title)}</text>`
		);
	}
	for (const group of snapshot.scene.groups) {
		const box = groupBoxes.get(group.id);
		if (box) {
			parts.push(groupMarkup(group, box));
		}
	}
	for (const edge of snapshot.scene.edges) {
		parts.push(edgeMarkup(edge, nodeIndex, edgeFontSize));
	}
	for (const node of snapshot.scene.nodes) {
		parts.push(nodeMarkup(node, nodeFontSize));
	}
	if (hasLegend) {
		parts.push(
			legendMarkup(
				snapshot.scene,
				height - padding - 6 - contentOffsetY,
				padding - contentOffsetX
			)
		);
	}
	parts.push('</g>');
	parts.push('</g>');
	parts.push(
		selectionMarkup(snapshot, nodeIndex, {
			x: contentOffsetX,
			y: contentOffsetY,
		})
	);
	parts.push('</svg>');
	return parts.join('');
}
