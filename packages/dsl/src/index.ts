import type { ParseResult } from './types';

export type {
	Color,
	Corner,
	Diagnostic,
	Diagram,
	Edge,
	Fill,
	GraphDiagram,
	Group,
	LegendEntry,
	Node,
	ParseResult,
	Position,
	Span,
} from './types';
export type { Direction, Frame, Head, Shape } from './vocab';
/** Canonical shape names, aliases, palette colors, style tokens, and resolution helpers. */
export {
	COLOR_ALIASES,
	COLORS,
	CORNERS,
	DIRECTIONS,
	FILLS,
	FRAMES,
	HEADS,
	resolveColor,
	resolveCorner,
	resolveFill,
	resolveFrame,
	resolveHead,
	resolveShape,
	SHAPE_ALIASES,
	SHAPES,
	slugify,
	uniqueId,
} from './vocab';

/**
 * Parse Kiyora DSL source text into a `Diagram` plus diagnostics.
 *
 * Tolerant contract: never throws, never returns null. Every problem is
 * reported as a diagnostic with a source span, and parsing continues past
 * malformed statements.
 *
 * v1 parses the graph family (architecture, flowchart, bpmn, orgchart,
 * statemachine); statement parsing lands in later increments. Until then
 * any input parses to an empty graph Diagram.
 */
export function parse(_source: string): ParseResult {
	return {
		diagnostics: [],
		diagram: {
			edges: [],
			groups: [],
			kind: 'graph',
			nodes: [],
			title: '',
		},
	};
}
