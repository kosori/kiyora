import { COLORS, type Color, type EntityField } from '@kiyora/dsl';
import { type Box, edgeCubic, edgeCubicPathD } from './geometry';
import { formatEntityField, measureLabel, measureLabelWidth } from './label';
import type { Scene, SceneEdge, SceneGroup, SceneNode } from './scene';
import { shapeComponents } from './shapes';
import {
	cornerRadius,
	dashAttrs,
	EDGE_FONT_SIZE,
	EDGE_STROKE,
	edgeColor,
	INK,
	NODE_FONT_SIZE,
	NODE_STROKE,
	resolveStyle,
	TEXT_PADDING,
} from './style';
import {
	deriveWobbleSeed,
	sampleCubic,
	sampleLine,
	sampleRoundedRect,
	type WobblePoint,
	wobbleOverlayDashedMarkup,
	wobbleOverlayGroup,
} from './wobble';

const SEQUENCE_MESSAGE_LABEL_OFFSET_Y = 8;
const ENTITY_MAX_WIDTH = 320;
const MEMBER_VERTICAL_PADDING = 4;
const MEMBER_FONT_SIZE_OFFSET = 2;
const KEY_FONT_SIZE_OFFSET = 4;

type SceneBounds = {
	maxX: number;
	maxY: number;
	minX: number;
	minY: number;
};

export type SceneProjectionOptions = {
	edgeFontSize?: number;
	nodeFontSize?: number;
	/** When false, node label text markup is omitted while node geometry and
	 * layout are untouched. Used by the interactive canvas to drop the most
	 * repeated text elements when zoomed far out. */
	showNodeLabels?: boolean;
	/** When true, render deterministic hand-drawn wobble overlays above the
	 * clean geometry. Defaults to false so static SVG/PNG export stays clean. */
	wobble?: boolean;
};

const MARKERS = `<marker id="kiyora-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke" stroke="context-stroke" stroke-width="1"/></marker><marker id="kiyora-circle" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto"><circle cx="5" cy="5" r="3" fill="context-stroke"/></marker><marker id="kiyora-cross" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M 2 2 L 8 8 M 8 2 L 2 8" fill="none" stroke="context-stroke" stroke-width="2" stroke-linecap="round"/></marker><marker id="kiyora-arrow-reverse" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M 10 0 L 0 5 L 10 10 z" fill="context-stroke" stroke="context-stroke" stroke-width="1"/></marker><marker id="kiyora-circle-reverse" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto"><circle cx="5" cy="5" r="3" fill="context-stroke"/></marker><marker id="kiyora-cross-reverse" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M 2 2 L 8 8 M 8 2 L 2 8" fill="none" stroke="context-stroke" stroke-width="2" stroke-linecap="round"/></marker><marker id="kiyora-crow-one" viewBox="0 0 14 14" refX="14" refY="7" markerWidth="14" markerHeight="14" orient="auto-start-reverse"><path d="M 6 2 L 6 12 M 10 2 L 10 12 M 0 7 L 14 7" fill="none" stroke="context-stroke" stroke-width="1.5"/></marker><marker id="kiyora-crow-many" viewBox="0 0 14 14" refX="14" refY="7" markerWidth="14" markerHeight="14" orient="auto-start-reverse"><path d="M 4 2 L 10 7 L 4 12 M 10 7 L 14 7 M 0 7 L 4 7" fill="none" stroke="context-stroke" stroke-width="1.5"/></marker><marker id="kiyora-crow-one-or-many" viewBox="0 0 14 14" refX="14" refY="7" markerWidth="14" markerHeight="14" orient="auto-start-reverse"><path d="M 4 2 L 10 7 L 4 12 M 10 7 L 14 7 M 0 7 L 4 7 M 8 2 L 8 12" fill="none" stroke="context-stroke" stroke-width="1.5"/></marker><marker id="kiyora-crow-zero-or-one" viewBox="0 0 14 14" refX="14" refY="7" markerWidth="14" markerHeight="14" orient="auto-start-reverse"><circle cx="4" cy="7" r="2.5" fill="none" stroke="context-stroke" stroke-width="1.5"/><path d="M 6.5 7 L 14 7 M 10 2 L 10 12" fill="none" stroke="context-stroke" stroke-width="1.5"/></marker><marker id="kiyora-uml-generalization" viewBox="0 0 14 14" refX="14" refY="7" markerWidth="14" markerHeight="14" orient="auto-start-reverse"><path d="M 0 2 L 12 7 L 0 12 z" fill="#ffffff" stroke="context-stroke" stroke-width="1.5"/></marker><marker id="kiyora-uml-composition" viewBox="0 0 14 14" refX="14" refY="7" markerWidth="14" markerHeight="14" orient="auto-start-reverse"><path d="M 0 7 L 6 2 L 12 7 L 6 12 z" fill="context-stroke" stroke="context-stroke" stroke-width="1.5"/></marker><marker id="kiyora-uml-aggregation" viewBox="0 0 14 14" refX="14" refY="7" markerWidth="14" markerHeight="14" orient="auto-start-reverse"><path d="M 0 7 L 6 2 L 12 7 L 6 12 z" fill="#ffffff" stroke="context-stroke" stroke-width="1.5"/></marker>`;
const EFFECTS = `<filter id="kiyora-shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000000" flood-opacity="0.12"/></filter>`;

const GROUP_PADDING = 30;
const GROUP_STROKE = 1.5;
const GROUP_DASH = 6;
const GROUP_DASH_GAP = 6;
const GROUP_FONT_SIZE = 13;

export function escapeText(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;');
}

function boxForNode(node: SceneNode): Box {
	return { height: node.height, width: node.width, x: node.x, y: node.y };
}

function unionBounds(bounds: SceneBounds, box: Box): SceneBounds {
	return {
		maxX: Math.max(bounds.maxX, box.x + box.width),
		maxY: Math.max(bounds.maxY, box.y + box.height),
		minX: Math.min(bounds.minX, box.x),
		minY: Math.min(bounds.minY, box.y),
	};
}

function expandBounds(bounds: SceneBounds | undefined, box: Box): SceneBounds {
	if (!bounds) {
		return {
			maxX: box.x + box.width,
			maxY: box.y + box.height,
			minX: box.x,
			minY: box.y,
		};
	}
	return unionBounds(bounds, box);
}

function expandBoundsCoord(
	bounds: SceneBounds | undefined,
	coord: { x?: number; y: number }
): SceneBounds {
	const x = coord.x ?? 0;
	if (!bounds) {
		return { maxX: x, maxY: coord.y, minX: x, minY: 0 };
	}
	return {
		maxX: coord.x === undefined ? bounds.maxX : Math.max(bounds.maxX, x),
		maxY: Math.max(bounds.maxY, coord.y),
		minX: coord.x === undefined ? bounds.minX : Math.min(bounds.minX, x),
		minY: bounds.minY,
	};
}

function toRect(bounds: SceneBounds): {
	height: number;
	width: number;
	x: number;
	y: number;
} {
	return {
		height: bounds.maxY - bounds.minY,
		width: bounds.maxX - bounds.minX,
		x: bounds.minX,
		y: bounds.minY,
	};
}

export function deriveGroupBoxes(scene: Scene): Map<string, Box> {
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
	const boxes = new Map<string, Box>();
	const resolving = new Set<string>();
	const resolve = (id: string): Box | undefined => {
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
		let bounds: SceneBounds | undefined;
		for (const node of nodesByGroup.get(id) ?? []) {
			bounds = expandBounds(bounds, boxForNode(node));
		}
		for (const child of childrenByParent.get(id) ?? []) {
			const childBox = resolve(child.id);
			if (childBox) {
				bounds = expandBounds(bounds, childBox);
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

export function contentBounds(
	scene: Scene,
	groupBoxes: Map<string, Box>
): { height: number; width: number; x: number; y: number } {
	let bounds: SceneBounds | undefined;
	for (const node of scene.nodes) {
		bounds = expandBounds(bounds, boxForNode(node));
	}
	for (const group of scene.groups) {
		const box = groupBoxes.get(group.id);
		if (!box) {
			continue;
		}
		bounds = expandBounds(bounds, box);
		bounds = expandBounds(bounds, {
			height: GROUP_FONT_SIZE,
			width: measureLabelWidth(group.label, GROUP_FONT_SIZE),
			x: box.x + 14,
			y: box.y + 4,
		});
	}
	for (const edge of scene.edges) {
		if (edge.y2 !== undefined) {
			const node = scene.nodes.find((n) => n.id === edge.from);
			const x = node ? node.x + node.width / 2 : 0;
			bounds = expandBoundsCoord(bounds, { x, y: edge.y2 });
		}
		if (edge.y !== undefined) {
			bounds = expandBoundsCoord(bounds, { y: edge.y });
		}
	}
	return toRect(bounds ?? { maxX: 0, maxY: 0, minX: 0, minY: 0 });
}

/** Group frame markup: a clean rect (dashed for standard graphs, solid for
 * statemachine compound states), an optional wobble overlay that preserves
 * the closed frame topology, and a clean label. */
function groupMarkup(
	group: SceneGroup,
	box: Box,
	wobble: boolean,
	isSolid = false
): string {
	const color = edgeColor(group.color ?? 'gray');
	const radius = cornerRadius(box.width, box.height);
	let overlay = '';
	if (wobble) {
		const seed = deriveWobbleSeed(`group:${group.id}`, [
			box.x,
			box.y,
			box.width,
			box.height,
		]);
		const points: WobblePoint[] = sampleRoundedRect(box, radius);
		overlay = wobbleOverlayDashedMarkup(
			seed,
			{
				closed: true,
				points,
				stroke: color,
				strokeWidth: GROUP_STROKE,
			},
			GROUP_DASH,
			GROUP_DASH_GAP
		);
	}
	const dashAttrs = isSolid
		? ''
		: ` stroke-dasharray="${GROUP_DASH} ${GROUP_DASH_GAP}" stroke-linecap="round"`;
	return `<g data-group="${escapeText(group.id)}"><rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" rx="${radius}" fill="none" stroke="${color}" stroke-width="${GROUP_STROKE}"${dashAttrs}/>${overlay}<text x="${box.x + 14}" y="${box.y + 18}" text-anchor="start" font-size="${GROUP_FONT_SIZE}" fill="${color}">${escapeText(group.label)}</text></g>`;
}

function straightEdgeWobbleOverlay(
	edgeId: string,
	from: WobblePoint,
	to: WobblePoint,
	color: string,
	dash: { dash?: number; gap?: number }
): string {
	const seed = deriveWobbleSeed(`edge:${edgeId}`, [
		from[0],
		from[1],
		to[0],
		to[1],
	]);
	const points = sampleLine(from, to);
	const contour = {
		closed: false,
		points,
		stroke: color,
		strokeWidth: EDGE_STROKE,
	};
	return dash.dash === undefined || dash.gap === undefined
		? wobbleOverlayGroup(seed, [contour])
		: wobbleOverlayDashedMarkup(seed, contour, dash.dash, dash.gap);
}

type StraightEdgeOptions = {
	color: string;
	dash: { dash?: number; gap?: number; strokeDasharray?: string };
	edgeFontSize: number;
	edgeId: string;
	from: WobblePoint;
	label?: string;
	labelY: number;
	markerEnd?: string;
	to: WobblePoint;
	wobble: boolean;
};

function straightEdgeMarkup(options: StraightEdgeOptions): string {
	const {
		color,
		dash,
		edgeFontSize,
		edgeId,
		from,
		label: labelText,
		labelY,
		markerEnd = '',
		to,
		wobble,
	} = options;
	const d = `M ${from[0]} ${from[1]} L ${to[0]} ${to[1]}`;
	const labelX = (from[0] + to[0]) / 2;
	const labelMarkup =
		labelText === undefined
			? ''
			: `<text x="${labelX}" y="${labelY}" text-anchor="middle" dominant-baseline="middle" font-size="${edgeFontSize}" fill="${INK}" stroke="#ffffff" stroke-width="4" paint-order="stroke">${escapeText(labelText)}</text>`;
	const overlay = wobble
		? straightEdgeWobbleOverlay(edgeId, from, to, color, dash)
		: '';
	const dashAttr = dash.strokeDasharray
		? ` stroke-dasharray="${dash.strokeDasharray}"`
		: '';
	return `<g data-edge="${escapeText(edgeId)}"><path d="${d}" fill="none" stroke="${color}" stroke-width="${EDGE_STROKE}" stroke-linecap="round"${dashAttr}${markerEnd}/>${overlay}${labelMarkup}</g>`;
}

/** Edge markup: the clean cubic path with clean markers, an optional open
 * wobble overlay (dashed runs for dashed edges), and a clean label.
 * Invisible or dangling edges render nothing. */
function edgeMarkup(
	edge: SceneEdge,
	nodes: Map<string, SceneNode>,
	edgeFontSize: number,
	wobble: boolean
): string {
	const from = nodes.get(edge.from);
	const to = nodes.get(edge.to);
	if (!(from && to) || edge.invisible) {
		return '';
	}
	const fromBox = boxForNode(from);
	const toBox = boxForNode(to);
	const color = edgeColor(edge.color);
	const head = edge.head ?? 'arrow';
	const dash = dashAttrs(edge.dashed ? 'dashed' : 'solid', EDGE_STROKE);

	if (edge.y2 !== undefined) {
		const x = fromBox.x + fromBox.width / 2;
		const y1 = edge.y1 ?? fromBox.y + fromBox.height;
		const { y2 } = edge;
		return straightEdgeMarkup({
			color,
			dash,
			edgeFontSize,
			edgeId: `${edge.from}-lifeline`,
			from: [x, y1],
			label: edge.label,
			labelY: (y1 + y2) / 2,
			to: [x, y2],
			wobble,
		});
	}

	if (edge.y !== undefined) {
		const startX = fromBox.x + fromBox.width / 2;
		const endX = toBox.x + toBox.width / 2;
		const { y } = edge;
		return straightEdgeMarkup({
			color,
			dash,
			edgeFontSize,
			edgeId: `${edge.from}-${edge.to}`,
			from: [startX, y],
			label: edge.label,
			labelY: y - SEQUENCE_MESSAGE_LABEL_OFFSET_Y,
			markerEnd: ` marker-end="url(#kiyora-${head})"`,
			to: [endX, y],
			wobble,
		});
	}

	const { c1, c2, end, start } = edgeCubic(fromBox, toBox);
	const d = edgeCubicPathD({ c1, c2, end, start });
	const markerStart = edge.fromHead
		? ` marker-start="url(#kiyora-${edge.fromHead})"`
		: edge.bidirectional
			? ` marker-start="url(#kiyora-${head}-reverse)"`
			: '';
	const markerEnd = ` marker-end="url(#kiyora-${head})"`;
	const label =
		edge.label === undefined
			? ''
			: `<text x="${(start.x + end.x) / 2}" y="${(start.y + end.y) / 2}" text-anchor="middle" dominant-baseline="middle" font-size="${edgeFontSize}" fill="${INK}" stroke="#ffffff" stroke-width="4" paint-order="stroke">${escapeText(edge.label)}</text>`;
	let overlay = '';
	if (wobble) {
		const seed = deriveWobbleSeed(`edge:${edge.from}->${edge.to}`, [
			start.x,
			start.y,
			c1.x,
			c1.y,
			c2.x,
			c2.y,
			end.x,
			end.y,
		]);
		const points: WobblePoint[] = sampleCubic(
			[start.x, start.y],
			[c1.x, c1.y],
			[c2.x, c2.y],
			[end.x, end.y]
		);
		const contour = {
			closed: false,
			points,
			stroke: color,
			strokeWidth: EDGE_STROKE,
		};
		overlay =
			dash.dash === undefined || dash.gap === undefined
				? wobbleOverlayGroup(seed, [contour])
				: wobbleOverlayDashedMarkup(seed, contour, dash.dash, dash.gap);
	}
	return `<g data-edge="${escapeText(`${edge.from}-${edge.to}`)}"><path d="${d}" fill="none" stroke="${color}" stroke-width="${EDGE_STROKE}" stroke-linecap="round"${dash.strokeDasharray ? ` stroke-dasharray="${dash.strokeDasharray}"` : ''}${markerStart}${markerEnd}/>${overlay}${label}</g>`;
}

/** Node markup: clean component geometry, optional per-component wobble
 * overlays inside the same rotated group, and clean labels. */
function nodeMarkup(
	node: SceneNode,
	fontSize: number,
	showLabels: boolean,
	wobble: boolean
): string {
	const style = resolveStyle(node.color ?? 'gray', node.fill ?? 'pastel');
	const box = boxForNode(node);
	const components = shapeComponents(
		node.shape ?? 'rectangle',
		box,
		style,
		NODE_STROKE,
		node.corner
	);
	const identity = `node:${node.id}`;
	const geometryParts = [
		node.shape ?? 'rectangle',
		node.corner ?? 'round',
		box.x,
		box.y,
		box.width,
		box.height,
	];
	let shape = '';
	for (const [index, component] of components.entries()) {
		shape += component.clean;
		if (wobble && component.contours) {
			const seed = deriveWobbleSeed(identity, [...geometryParts, index]);
			shape += wobbleOverlayGroup(seed, component.contours);
		}
	}
	let labels = '';
	if (showLabels) {
		const textColor = node.labelColor ? edgeColor(node.labelColor) : style.text;

		if (node.shape === 'entity') {
			const headerMetrics = measureLabel(node.label, {
				fontSize,
				maxWidth: Math.max(1, box.width - TEXT_PADDING * 2),
				verticalPadding: TEXT_PADDING,
			});
			const headerHeight = headerMetrics.height + TEXT_PADDING;
			const radius =
				node.corner === 'sharp' ? 0 : cornerRadius(box.width, box.height);

			if (node.color || node.fill) {
				const fillPath =
					radius === 0
						? `M ${box.x} ${box.y} L ${box.x + box.width} ${box.y} L ${box.x + box.width} ${box.y + headerHeight} L ${box.x} ${box.y + headerHeight} Z`
						: `M ${box.x} ${box.y + radius} A ${radius} ${radius} 0 0 1 ${box.x + radius} ${box.y} L ${box.x + box.width - radius} ${box.y} A ${radius} ${radius} 0 0 1 ${box.x + box.width} ${box.y + radius} L ${box.x + box.width} ${box.y + headerHeight} L ${box.x} ${box.y + headerHeight} Z`;
				labels += `<path d="${fillPath}" fill="${style.fill}" stroke="none" />`;
			}

			const titleY = box.y + TEXT_PADDING / 2 + headerMetrics.lineHeight / 2;
			labels += headerMetrics.lines
				.map(
					(line, index) =>
						`<text x="${box.x + box.width / 2}" y="${titleY + index * headerMetrics.lineHeight}" text-anchor="middle" dominant-baseline="middle" font-size="${fontSize}" font-weight="bold" fill="${textColor}">${escapeText(line)}</text>`
				)
				.join('');

			let currentY = box.y + headerHeight;

			const drawDivider = (yOffset: number) => {
				labels += `<path d="M ${box.x} ${yOffset} L ${box.x + box.width} ${yOffset}" fill="none" stroke="${style.stroke}" stroke-width="${NODE_STROKE}" stroke-linecap="round"/>`;
				if (wobble) {
					const seed = deriveWobbleSeed(`${identity}:div`, [
						box.x,
						yOffset,
						box.width,
					]);
					const points = sampleLine(
						[box.x, yOffset],
						[box.x + box.width, yOffset]
					);
					labels += wobbleOverlayGroup(seed, [
						{
							closed: false,
							points,
							stroke: style.stroke,
							strokeWidth: NODE_STROKE,
						},
					]);
				}
			};

			const drawList = (items: EntityField[], startY: number) => {
				let y = startY + MEMBER_VERTICAL_PADDING;
				for (const item of items) {
					const text = formatEntityField(item);
					const textMetrics = measureLabel(text, {
						fontSize: fontSize - MEMBER_FONT_SIZE_OFFSET,
						maxWidth: ENTITY_MAX_WIDTH,
					});
					labels += textMetrics.lines
						.map(
							(line, index) =>
								`<text x="${box.x + TEXT_PADDING}" y="${y + index * textMetrics.lineHeight + textMetrics.lineHeight / 2}" text-anchor="start" dominant-baseline="middle" font-size="${fontSize - MEMBER_FONT_SIZE_OFFSET}" fill="${textColor}">${escapeText(line)}</text>`
						)
						.join('');
					if (item.key) {
						labels += `<text x="${box.x + box.width - TEXT_PADDING}" y="${y + textMetrics.lineHeight / 2}" text-anchor="end" dominant-baseline="middle" font-size="${fontSize - KEY_FONT_SIZE_OFFSET}" font-weight="bold" fill="${textColor}">${escapeText(item.key.toUpperCase())}</text>`;
					}
					y += textMetrics.height;
				}
				return y + MEMBER_VERTICAL_PADDING;
			};

			if (node.fields && node.fields.length > 0) {
				drawDivider(currentY);
				currentY = drawList(node.fields, currentY);
			}

			if (node.methods && node.methods.length > 0) {
				drawDivider(currentY);
				currentY = drawList(node.methods, currentY);
			}
		} else {
			const metrics = measureLabel(node.label, {
				fontSize,
				maxWidth: Math.max(1, box.width - TEXT_PADDING * 2),
				verticalPadding: TEXT_PADDING * 2,
			});
			const firstY =
				box.y +
				box.height / 2 -
				((metrics.lines.length - 1) * metrics.lineHeight) / 2;
			labels = metrics.lines
				.map(
					(line, index) =>
						`<text x="${box.x + box.width / 2}" y="${firstY + index * metrics.lineHeight}" text-anchor="middle" dominant-baseline="middle" font-size="${fontSize}" fill="${textColor}">${escapeText(line)}</text>`
				)
				.join('');
		}
	}
	const filter = node.shadow ? ' filter="url(#kiyora-shadow)"' : '';
	const rotation =
		node.rotation === 0
			? ''
			: ` transform="rotate(${node.rotation} ${box.x + box.width / 2} ${box.y + box.height / 2})"`;
	return `<g data-node="${escapeText(node.id)}"${filter}${rotation}>${shape}${labels}</g>`;
}

export function renderSceneElements(
	scene: Scene,
	groupBoxes: Map<string, Box>,
	options: SceneProjectionOptions = {}
): string {
	const edgeFontSize = options.edgeFontSize ?? EDGE_FONT_SIZE;
	const nodeFontSize = options.nodeFontSize ?? NODE_FONT_SIZE;
	const showNodeLabels = options.showNodeLabels ?? true;
	const wobble = options.wobble ?? false;
	const isSolid = scene.variant === 'statemachine';
	const parts: string[] = [];
	for (const group of scene.groups) {
		const box = groupBoxes.get(group.id);
		if (box) {
			parts.push(groupMarkup(group, box, wobble, isSolid));
		}
	}
	const nodes = new Map(scene.nodes.map((node) => [node.id, node]));
	for (const edge of scene.edges) {
		parts.push(edgeMarkup(edge, nodes, edgeFontSize, wobble));
	}
	for (const node of scene.nodes) {
		parts.push(nodeMarkup(node, nodeFontSize, showNodeLabels, wobble));
	}
	return parts.join('');
}

export function renderTitleMarkup(scene: Scene, x: number, y: number): string {
	if (scene.title.length === 0) {
		return '';
	}
	return `<text x="${x}" y="${y}" text-anchor="start" font-size="18" font-weight="600" fill="${INK}">${escapeText(scene.title)}</text>`;
}

export function renderDefs(): string {
	return `${MARKERS}${EFFECTS}`;
}

function isPaletteColor(value: string): value is Color {
	return COLORS.some((color) => color === value);
}

function safeLegendColor(swatch: string): string {
	return isPaletteColor(swatch) ? edgeColor(swatch) : INK;
}

export function legendWidth(scene: Scene): number {
	return (scene.legend ?? []).reduce(
		(total, entry) => total + 24 + measureLabelWidth(entry.label, 12) + 24,
		0
	);
}

export function renderLegendMarkup(
	scene: Scene,
	y: number,
	padding: number
): string {
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

export const TITLE_HEIGHT = 30;
export const LEGEND_HEIGHT = 30;
export const DEFAULT_PADDING = 24;

export function scenePlacement(
	scene: Scene,
	padding = DEFAULT_PADDING
): { x: number; y: number } {
	const groupBoxes = deriveGroupBoxes(scene);
	const bounds = contentBounds(scene, groupBoxes);
	return {
		x: padding - bounds.x,
		y: padding + (scene.title.length > 0 ? TITLE_HEIGHT : 0) - bounds.y,
	};
}

export function sceneSize(
	scene: Scene,
	padding = DEFAULT_PADDING
): { height: number; width: number } {
	const groupBoxes = deriveGroupBoxes(scene);
	const bounds = contentBounds(scene, groupBoxes);
	const contentWidth = Math.max(0, bounds.width);
	const contentHeight = Math.max(0, bounds.height);
	const hasTitle = scene.title.length > 0;
	const hasLegend = (scene.legend?.length ?? 0) > 0;
	return {
		height: Math.max(
			1,
			contentHeight +
				padding * 2 +
				(hasTitle ? TITLE_HEIGHT : 0) +
				(hasLegend ? LEGEND_HEIGHT : 0)
		),
		width: Math.max(
			1,
			contentWidth + padding * 2,
			hasTitle ? measureLabelWidth(scene.title, 18) + padding * 2 : 0,
			hasLegend ? legendWidth(scene) + padding : 0
		),
	};
}
