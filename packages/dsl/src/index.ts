/**
 * The Kiyora DSL parser: turns Kira source text into a typed `Diagram` AST
 * plus a list of diagnostics with full source spans.
 *
 * Tolerant contract (ADR-0001): `parse` never throws and never returns null.
 * An `error`-severity diagnostic means that statement was dropped; a
 * `warning` means it parsed with a caveat. Parsing continues past malformed
 * statements, and unclosed blocks are reported at end of input.
 *
 * Module layout: AST types live in `./types`, the vocabulary (shapes, colors,
 * aliases, resolution helpers) in `./vocab`, quote/bracket-aware scanning in
 * `./scan`, attribute-block parsing in `./attributes`, and the graph-family
 * statement parser in `./graph`. Scanner internals are not exported; this
 * entry point is the package's public surface.
 */

import { parseGraph } from './graph';
import type { ParseResult } from './types';

export type {
	Color,
	Corner,
	Diagnostic,
	DiagnosticCode,
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
export type { Direction, Family, Frame, Head, Shape } from './vocab';
/** Canonical shape names, aliases, palette colors, style tokens, and resolution helpers. */
export {
	ARROWS,
	COLOR_ALIASES,
	COLORS,
	CORNERS,
	DIRECTIONS,
	FAMILIES,
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
	STANDALONE_FAMILIES,
	slugify,
	UNSUPPORTED_GRAPH_FAMILIES,
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
 * statemachine).
 */
export function parse(source: string): ParseResult {
	return parseGraph(source);
}
