/**
 * The Kiyora DSL parser contract: Diagram AST, diagnostics, and spans.
 *
 * `parse` never throws and never returns null. Problems are reported as
 * diagnostics: an `error` means that statement was dropped, a `warning`
 * means it parsed with a caveat.
 */

/** A 1-based `{ line, column }` position within Kira source text. */
export type Position = {
	column: number;
	line: number;
};

/** A source range, 1-based inclusive start and end positions. */
export type Span = {
	end: Position;
	start: Position;
};

/** Machine-readable diagnostic codes emitted by the v1 parser. */
export type DiagnosticCode =
	| 'attribute-ignored'
	| 'expected-colon'
	| 'expected-node-name'
	| 'unclosed-block'
	| 'unknown-attribute'
	| 'unknown-color'
	| 'unknown-shape'
	| 'unmatched-block'
	| 'unsupported-family'
	| 'self-edge';

/** A reported problem with Kiyora DSL source. */
export type Diagnostic = {
	code: DiagnosticCode;
	message: string;
	severity: 'error' | 'warning';
	span: Span;
};

/** One of the 9 v1 palette color tokens (plus `grey`/`purple` aliases). */
export type Color =
	| 'blue'
	| 'green'
	| 'red'
	| 'orange'
	| 'violet'
	| 'teal'
	| 'pink'
	| 'yellow'
	| 'gray';

/** Fill styles: the default fill a node gets without an explicit fill. */
export type Fill = 'pastel' | 'bold' | 'outline';

/** Corner styles. */
export type Corner = 'sharp' | 'rounded';

/** A node inside a graph-family Diagram. */
export type Node = {
	color?: Color;
	corner?: Corner;
	fill?: Fill;
	group?: string;
	icon?: string;
	id: string;
	label: string;
	labelColor?: Color;
	link?: string;
	shadow?: boolean;
	shape?: string;
	span: Span;
};

/** A group of nodes inside a graph-family Diagram. */
export type Group = {
	color?: Color;
	frame?: string;
	icon?: string;
	id: string;
	label: string;
	parent?: string;
	span: Span;
};

/** A directed connection between two nodes inside a graph-family Diagram. */
export type Edge = {
	back?: boolean;
	bidirectional?: boolean;
	color?: Color;
	dashed?: boolean;
	flow?: boolean;
	from: string;
	head?: string;
	invisible?: boolean;
	label?: string;
	span: Span;
	to: string;
};

/** A legend entry: a swatch meaning pair declared with `legend { … }`. */
export type LegendEntry = {
	label: string;
	swatch: string;
};

/** A graph-family diagram: nodes, edges, groups, and diagram-level settings. */
export type GraphDiagram = {
	direction?: 'right' | 'down' | 'left' | 'up';
	edges: Edge[];
	groups: Group[];
	icons?: 'badge' | 'inside';
	kanban?: boolean;
	kind: 'graph';
	legend?: LegendEntry[];
	nodes: Node[];
	swimlanes?: boolean;
	title: string;
	/** Sub-variant of the graph family: `orgchart` and `statemachine` (reference semantics). */
	variant?: 'orgchart' | 'statemachine';
};

/** A participant in a sequence diagram. */
export type Actor = {
	id: string;
	label: string;
	span: Span;
};

/** A communication between actors in a sequence diagram. */
export type Message = {
	dashed?: boolean;
	from: string;
	label?: string;
	span: Span;
	to: string;
};

/** A sequence-family diagram: actors, messages, and title. */
export type SequenceDiagram = {
	actors: Actor[];
	kind: 'sequence';
	messages: Message[];
	title: string;
};

/** Every Diagram is discriminated by `kind`. */
export type Diagram = GraphDiagram | SequenceDiagram;

/** The result of parsing Kira source: a best-effort Diagram plus diagnostics. */
export type ParseResult = {
	diagnostics: Diagnostic[];
	diagram: Diagram;
};
