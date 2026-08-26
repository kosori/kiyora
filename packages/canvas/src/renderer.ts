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
import type { EditorSnapshot } from './editor';
import { worldToScreen } from './viewport';

/** Options for the canvas SVG projection. */
export type RenderSceneOptions = {
	edgeFontSize?: number;
	fontFamily?: string;
	height?: number;
	nodeFontSize?: number;
	padding?: number;
	showGrid?: boolean;
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
			return `<rect x="${topLeft.x - 3}" y="${topLeft.y - 3}" width="${bottomRight.x - topLeft.x + 6}" height="${bottomRight.y - topLeft.y + 6}" rx="${radius}" fill="none" stroke="${SELECTION_COLOR}" stroke-width="1.5" stroke-dasharray="4 3"/>`;
		})
		.join('');
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
		? renderTitleMarkup(
				snapshot.scene,
				bounds.minX,
				bounds.minY - TITLE_HEIGHT + 18
			)
		: '';
	const legend = hasLegend
		? renderLegendMarkup(
				snapshot.scene,
				height - padding - 6 - placement.y,
				bounds.minX
			)
		: '';
	const chrome =
		options.showGrid === false
			? `<rect width="${width}" height="${height}" fill="${BACKGROUND_COLOR}"/>`
			: renderGrid(snapshot.viewport, width, height);
	const body = [
		`<defs>${renderDefs()}</defs>`,
		chrome,
		`<g transform="translate(${snapshot.viewport.tx} ${snapshot.viewport.ty}) scale(${snapshot.viewport.zoom})" font-family="${fontFamily}">`,
		title,
		renderSceneElements(snapshot.scene, groupBoxes, options),
		legend,
		'</g>',
		selectionMarkup(snapshot, nodeIndex),
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
