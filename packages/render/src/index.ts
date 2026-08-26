import type { Diagram } from '@kiyora/dsl';
import { compile } from './compile';
import {
	contentBounds,
	DEFAULT_PADDING,
	deriveGroupBoxes,
	escapeText,
	renderDefs,
	renderLegendMarkup,
	renderSceneElements,
	renderTitleMarkup,
	sceneSize,
	TITLE_HEIGHT,
} from './projection';
import type { Scene } from './scene';
import { FONT_HAND } from './style';

export { compile } from './compile';
export type { Box, Point } from './geometry';
export * as geometry from './geometry';
export { edgePathD, intersectRect } from './geometry';
export type { LabelMeasureOptions, LabelMetrics } from './label';
export * as label from './label';
export { measureLabel, measureLabelWidth, wrapLabel } from './label';
export type { Box as LayoutBox, Layout, LayoutOptions } from './layout';
export * as layout from './layout';
export { layoutGraph, measureNode } from './layout';
export {
	contentBounds,
	DEFAULT_PADDING,
	deriveGroupBoxes,
	escapeText,
	LEGEND_HEIGHT,
	legendWidth,
	renderDefs,
	renderLegendMarkup,
	renderSceneElements,
	renderTitleMarkup,
	scenePlacement,
	sceneSize,
	TITLE_HEIGHT,
} from './projection';
export type { Scene, SceneEdge, SceneGroup, SceneNode } from './scene';
export type { ShapeKind } from './shapes';
export * as shapes from './shapes';
export { FALLBACK_SHAPES, renderShape, roundedRectPath } from './shapes';
export type {
	FillStyle,
	PaletteColor,
	ResolvedFill,
	Style,
} from './style';
export * as style from './style';
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

/** Project a Scene into a static SVG document. */
export function renderToSvg(
	scene: Scene,
	options: RenderOptions = {}
): RenderResult {
	const padding = options.padding ?? DEFAULT_PADDING;
	const size = sceneSize(scene, padding);
	const groupBoxes = deriveGroupBoxes(scene);
	const bounds = contentBounds(scene, groupBoxes);
	const hasTitle = scene.title.length > 0;
	const hasLegend = (scene.legend?.length ?? 0) > 0;
	const width = options.width ?? size.width;
	const height = options.height ?? size.height;
	const fontFamily = escapeText(options.fontFamily ?? FONT_HAND);
	const contentOffsetY = padding + (hasTitle ? TITLE_HEIGHT : 0) - bounds.minY;
	const parts: string[] = [
		`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="${fontFamily}"><defs>${renderDefs()}</defs>`,
	];
	if (hasTitle) {
		parts.push(renderTitleMarkup(scene, padding, padding + 18));
	}
	parts.push(
		`<g transform="translate(${padding - bounds.minX} ${contentOffsetY})">`,
		renderSceneElements(scene, groupBoxes, options),
		'</g>'
	);
	if (hasLegend) {
		parts.push(renderLegendMarkup(scene, height - padding - 6, padding));
	}
	parts.push('</svg>');
	return { height, svg: parts.join(''), width };
}

/** Compile a diagram and project it to SVG. */
export function render(
	diagram: Diagram,
	options?: RenderOptions
): RenderResult {
	const layoutOptions =
		options?.nodeFontSize === undefined
			? undefined
			: { fontSize: options.nodeFontSize };
	return renderToSvg(compile(diagram, layoutOptions), options);
}
