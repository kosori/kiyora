import {
	contentBounds,
	cornerRadius,
	DEFAULT_PADDING,
	deriveGroupBoxes,
	escapeText,
	renderDefs,
	renderLegendMarkup,
	renderSceneElements,
	renderTitleMarkup,
	type SceneNode,
	scenePlacement,
	sceneSize,
	TITLE_HEIGHT,
} from '@kiyora/render';
import type { EditorSnapshot, MarqueeRect } from './editor';
import {
	HANDLE_SIZE,
	handleScreenCenter,
	RESIZE_HANDLES,
	SELECTION_OUTSET,
	singleSelectedNode,
} from './resize';
import { worldToScreen } from './viewport';

/** Options for the canvas SVG projection. */
export type RenderSceneOptions = {
	edgeFontSize?: number;
	fontFamily?: string;
	height?: number;
	nodeFontSize?: number;
	padding?: number;
	showGrid?: boolean;
	/** Overrides the zoom-derived default. Omitted node labels keep node
	 * geometry and layout untouched. */
	showNodeLabels?: boolean;
	/** When true, render deterministic hand-drawn wobble overlays above the
	 * clean geometry. Defaults to false so callers stay clean unless they
	 * request the display-only aesthetic layer. */
	wobble?: boolean;
	width?: number;
};

export type RenderSceneResult = {
	body: string;
	height: number;
	viewBox: string;
	width: number;
};

const DEFAULT_FONT_FAMILY = "'Balsamiq Sans Neue', cursive";
const GRID_SPACING = 24;
const GRID_COLOR = '#c8cdd4';
const BACKGROUND_COLOR = '#fbfcfe';
const SELECTION_COLOR = '#4dabf7';
const HANDLE_COLOR = '#ffffff';
// Node labels are the most repeated text on the canvas; hide them below this
// zoom so far-out views stop paying per-glyph cost.
const NODE_LABELS_VISIBLE_ABOVE_ZOOM = 0.2;
// SELECTION_COLOR (#4dabf7) at 12% alpha for the marquee wash.
const MARQUEE_FILL = 'rgba(77,171,247,0.12)';

/** Dot-density tiers: below each threshold, render every nth dot instead. */
const DOT_DENSITY_TIERS = [
	{ minZoom: 0.65, step: 1 },
	{ minZoom: 0.35, step: 2 },
	{ minZoom: 0.15, step: 4 },
] as const;
const DOT_DENSITY_FALLBACK_STEP = 8;
// Even every eighth dot is hundreds of circles at extreme zoom-out, where the
// grid is an unreadable wash; below this zoom the background stays dot-free.
const DOT_MIN_ZOOM = 0.1;

/** The index step for rendered dots, or 0 when the grid has no dots. */
function dotStepForZoom(zoom: number): number {
	if (zoom < DOT_MIN_ZOOM) {
		return 0;
	}
	for (const tier of DOT_DENSITY_TIERS) {
		if (zoom >= tier.minZoom) {
			return tier.step;
		}
	}
	return DOT_DENSITY_FALLBACK_STEP;
}

/** True when a grid index lands on a kept dot for the active density step. */
function dotIsKept(index: number, step: number): boolean {
	return ((index % step) + step) % step === 0;
}

function renderGrid(
	viewport: EditorSnapshot['viewport'],
	width: number,
	height: number
): string {
	const gap = GRID_SPACING * viewport.zoom;
	const dots: string[] = [];
	const step = dotStepForZoom(viewport.zoom);
	if (gap > 0 && Number.isFinite(gap) && step > 0) {
		const radius = Math.max(0.5, viewport.zoom * 0.6);
		const firstI = Math.ceil(-viewport.tx / gap);
		const lastI = Math.floor((width - viewport.tx) / gap);
		const firstJ = Math.ceil(-viewport.ty / gap);
		const lastJ = Math.floor((height - viewport.ty) / gap);
		for (let i = firstI; i <= lastI; i += 1) {
			if (!dotIsKept(i, step)) {
				continue;
			}
			const x = viewport.tx + i * gap;
			for (let j = firstJ; j <= lastJ; j += 1) {
				if (!dotIsKept(j, step)) {
					continue;
				}
				const y = viewport.ty + j * gap;
				dots.push(
					`<circle cx="${x}" cy="${y}" r="${radius}" fill="${GRID_COLOR}"/>`
				);
			}
		}
	}
	return `<rect width="${width}" height="${height}" fill="${BACKGROUND_COLOR}"/><g>${dots.join('')}</g>`;
}

function selectionMarkup(
	snapshot: EditorSnapshot,
	nodeIndex: Map<string, SceneNode>
): string {
	return snapshot.selection
		.map((id) => {
			const node = nodeIndex.get(id);
			if (!node) {
				return '';
			}
			const topLeft = worldToScreen(snapshot.viewport, node);
			const bottomRight = worldToScreen(snapshot.viewport, {
				x: node.x + node.width,
				y: node.y + node.height,
			});
			const radius = Math.max(
				4,
				cornerRadius(node.width, node.height) * snapshot.viewport.zoom
			);
			const outset = SELECTION_OUTSET;
			return `<rect x="${topLeft.x - outset}" y="${topLeft.y - outset}" width="${bottomRight.x - topLeft.x + outset * 2}" height="${bottomRight.y - topLeft.y + outset * 2}" rx="${radius}" fill="none" stroke="${SELECTION_COLOR}" stroke-width="1.5" stroke-dasharray="4 3"/>`;
		})
		.join('');
}

function resizeHandlesMarkup(
	snapshot: EditorSnapshot,
	nodeIndex: Map<string, SceneNode>
): string {
	if (snapshot.scene.readOnly) {
		return '';
	}
	const node = singleSelectedNode(nodeIndex, snapshot.selection);
	if (!node) {
		return '';
	}

	const handles: string[] = [];
	for (const handle of RESIZE_HANDLES) {
		const center = handleScreenCenter(snapshot.viewport, node, handle);
		const half = HANDLE_SIZE / 2;
		handles.push(
			`<rect data-resize-handle="${handle}" aria-hidden="true" x="${center.x - half}" y="${center.y - half}" width="${HANDLE_SIZE}" height="${HANDLE_SIZE}" fill="${HANDLE_COLOR}" stroke="${SELECTION_COLOR}" stroke-width="1"/>`
		);
	}
	return handles.join('');
}

function marqueeMarkup(marquee: MarqueeRect | null): string {
	if (!marquee) {
		return '';
	}
	const x = Math.min(marquee.x1, marquee.x2);
	const y = Math.min(marquee.y1, marquee.y2);
	const width = Math.abs(marquee.x2 - marquee.x1);
	const height = Math.abs(marquee.y2 - marquee.y1);
	return `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${MARQUEE_FILL}" stroke="${SELECTION_COLOR}" stroke-width="1"/>`;
}

/** Build the structured projection consumed by the DOM engine. */
export function renderSceneResult(
	snapshot: EditorSnapshot,
	options: RenderSceneOptions = {}
): RenderSceneResult {
	const padding = options.padding ?? DEFAULT_PADDING;
	const size = sceneSize(snapshot.scene, padding);
	const width = options.width ?? size.width;
	const height = options.height ?? size.height;
	const fontFamily = escapeText(options.fontFamily ?? DEFAULT_FONT_FAMILY);
	const groupBoxes = deriveGroupBoxes(snapshot.scene);
	const nodeIndex = new Map(
		snapshot.scene.nodes.map((node) => [node.id, node])
	);
	const bounds = contentBounds(snapshot.scene, groupBoxes);
	const placement = scenePlacement(snapshot.scene, padding);
	const hasTitle = snapshot.scene.title.length > 0;
	const hasLegend = (snapshot.scene.legend?.length ?? 0) > 0;
	const title = hasTitle
		? renderTitleMarkup(snapshot.scene, bounds.x, bounds.y - TITLE_HEIGHT + 18)
		: '';
	const legend = hasLegend
		? renderLegendMarkup(
				snapshot.scene,
				height - padding - 6 - placement.y,
				bounds.x
			)
		: '';
	const chrome =
		options.showGrid === false
			? `<rect width="${width}" height="${height}" fill="${BACKGROUND_COLOR}"/>`
			: renderGrid(snapshot.viewport, width, height);
	const showNodeLabels =
		options.showNodeLabels ??
		snapshot.viewport.zoom >= NODE_LABELS_VISIBLE_ABOVE_ZOOM;
	const body = [
		`<defs>${renderDefs()}</defs>`,
		chrome,
		`<g transform="translate(${snapshot.viewport.tx} ${snapshot.viewport.ty}) scale(${snapshot.viewport.zoom})" font-family="${fontFamily}">`,
		title,
		renderSceneElements(snapshot.scene, groupBoxes, {
			...options,
			showNodeLabels,
		}),
		legend,
		'</g>',
		selectionMarkup(snapshot, nodeIndex),
		resizeHandlesMarkup(snapshot, nodeIndex),
		marqueeMarkup(snapshot.marquee),
	].join('');
	return { body, height, viewBox: `0 0 ${width} ${height}`, width };
}

/** Project an Editor snapshot into a complete, interactive-canvas SVG string. */
export function renderScene(
	snapshot: EditorSnapshot,
	options: RenderSceneOptions = {}
): string {
	const result = renderSceneResult(snapshot, options);
	const fontFamily = escapeText(options.fontFamily ?? DEFAULT_FONT_FAMILY);
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${result.width}" height="${result.height}" viewBox="${result.viewBox}" style="touch-action:none;user-select:none" font-family="${fontFamily}">${result.body}</svg>`;
}
