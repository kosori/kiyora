/**
 * Graph-family statement parser: nodes, comma-separated node lists, quoted
 * names, groups (including nesting), and edges.
 *
 * Line-oriented: a statement ends at a newline; blank lines and `//`
 * comments are ignored. Nodes are declared by name (`Cache`) or with an
 * explicit id (`cache-1 = Cache Server`); ids are slugified with `-2`/`-3`
 * deduplication and lookup is case-insensitive by name or explicit id.
 * Redeclaring a node merges attributes: earlier attributes are preserved,
 * new ones fill gaps, and the later label wins. An attribute block at the
 * end of a comma-separated list applies to every node in the list.
 *
 * Edge statements connect nodes: solid (`->`), dashed (`-->`, `<--`), dotted
 * (`-.->`, `..>`, `<-.-`, `<..`), bidirectional (`<->`, `<-->`, `<..>`,
 * `<-.->`), and reverse (`<-`, `<--`, `<..`) arrows, plus the bare `>`/`<`
 * shorthand and `<>`. Chains (`A -> B -> C`) produce one edge per hop, and
 * comma sources/targets fan out and in (`A, B -> C, D`). An optional
 * `: label` after the first connector labels every edge of the statement;
 * a trailing attribute block applies to the edges. Nodes first seen inside
 * an edge are auto-declared; self-edges are reported with a `self-edge`
 * diagnostic and dropped. Edges inside a group carry that group on the
 * nodes they declare.
 *
 * Groups (`group Name { A, B }`) may nest; a node opened inside a group
 * carries that group's id as its `group`, and nested groups record their
 * parent. Every produced item carries a full `Span`; unknown
 * attribute/shape/color tokens produce warning diagnostics with
 * kebab-case codes and parsing continues.
 */

import { type Attrs, parseAttrs } from './attributes';
import {
	findConnector,
	findToken,
	scanHops,
	splitListOffsets,
	splitOn,
	splitTrailingAttrs,
	stripComment,
	unquote,
} from './scan';
import type {
	Diagnostic,
	Edge,
	Group,
	LegendEntry,
	Node,
	ParseResult,
	Span,
} from './types';
import type { Family } from './vocab';
import {
	ARROWS,
	FAMILIES,
	resolveFill,
	STANDALONE_FAMILIES,
	slugify,
	UNSUPPORTED_GRAPH_FAMILIES,
	uniqueId,
} from './vocab';

/** Graph-family state accumulated while scanning lines. */
type GraphState = {
	defaultFill?: 'pastel' | 'bold' | 'outline';
	diagnostics: Diagnostic[];
	direction?: 'right' | 'down' | 'left' | 'up';
	edges: Edge[];
	family: Family | null;
	groupByKey: Map<string, string>;
	groups: Group[];
	icons?: 'badge' | 'inside';
	inLegend: boolean;
	kanban: boolean;
	legend: LegendEntry[];
	nodeByKey: Map<string, string>;
	nodes: Node[];
	title: string;
	usedIds: Set<string>;
};

/** Parse Kira source as a graph-family diagram (v1 default family). */
export function parseGraph(source: string): ParseResult {
	const state: GraphState = {
		diagnostics: [],
		edges: [],
		family: null,
		groupByKey: new Map(),
		groups: [],
		inLegend: false,
		kanban: false,
		legend: [],
		nodeByKey: new Map(),
		nodes: [],
		title: '',
		usedIds: new Set(),
	};
	const lines = source.split('\n');
	const groupStack: string[] = [];
	for (let i = 0; i < lines.length; i += 1) {
		const lineNo = i + 1;
		const line = stripComment(lines[i] ?? '').trim();
		if (!line) {
			continue;
		}
		const span = spanAt(lineNo, 1, line.length);
		// The first non-empty line picks the family. A recognized graph
		// header (whole-line match) selects that family; a recognized but
		// unsupported header is refused with `unsupported-family` and
		// yields an empty graph; anything else falls through to the
		// default architecture family.
		if (state.family === null) {
			const detect = detectFamily(line, span, state.diagnostics);
			// A recognized-but-unsupported family (e.g. `sequence`) is
			// refused here: one `unsupported-family` error and an empty
			// graph, with no later lines misparsed as graph shapes.
			if (detect.skipLine && detect.family === null) {
				return {
					diagnostics: state.diagnostics,
					diagram: buildDiagram(state),
				};
			}
			if (detect.skipLine) {
				state.family = detect.family;
				continue;
			}
			state.family = detect.family ?? 'architecture';
		}
		// Directives may appear anywhere, on their own lines.
		if (consumeDirective(state, line, span)) {
			continue;
		}
		if (/^group\b/.test(line)) {
			if (/^group\b.*\{.*\}$/.test(line)) {
				parseInlineGroup(state, groupStack, line, lineNo, span);
			} else if (/^group\b.*\{$/.test(line)) {
				parseGroupOpen(state, groupStack, line, lineNo, span);
			} else {
				state.diagnostics.push({
					code: 'expected-node-name',
					message: 'expected a node name',
					severity: 'error',
					span,
				});
			}
			continue;
		}
		if (/^\}\s*$/.test(line)) {
			groupStack.pop();
			continue;
		}
		// An edge statement if any arrow token appears outside quotes and
		// brackets. Nodes first seen here are auto-declared; self-edges are
		// reported and dropped.
		if (findConnector(line, ARROWS) !== null) {
			parseEdgeLine(state, groupStack.at(-1), line, lineNo);
			continue;
		}
		// A node statement or comma-separated node list; a trailing
		// `[ … ]` block applies to every node in the list. Inside a
		// group, every line is treated the same way (group members are
		// ordinary node statements that carry the group), and members
		// may carry their own trailing attributes.
		const inGroup = groupStack.at(-1);
		const { attrs, rest } = splitTrailingAttrs(line);
		const a = parseAttrs(
			attrs ?? '',
			lineNo,
			rest.length + 2,
			state.diagnostics
		);
		for (const part of splitList(rest)) {
			const text = part.trim();
			if (!text) {
				continue;
			}
			const { id, name } = parseName(text);
			if (!name) {
				state.diagnostics.push({
					code: 'expected-node-name',
					message: 'expected a node name',
					severity: 'error',
					span,
				});
				continue;
			}
			getOrCreateNode(state, name, a, id, span, inGroup);
		}
	}
	return {
		diagnostics: state.diagnostics,
		diagram: buildDiagram(state),
	};
}

/** The family selected by the first non-empty line, if the line was a header. */
type FamilyDetect = { family: Family | null; skipLine: boolean };

/**
 * Detect a family header on the first non-empty line. A recognized graph
 * keyword selects that family (the line is consumed). A recognized but
 * unsupported family keyword produces one `unsupported-family` error and
 * the line is consumed (an empty graph results). Anything else is left for
 * the regular statement parser with the default architecture family.
 */
function detectFamily(
	line: string,
	span: Span,
	diagnostics: Diagnostic[]
): FamilyDetect {
	const word = line.toLowerCase();
	const family = FAMILIES[word];
	if (family !== undefined) {
		return { family: family as Family, skipLine: true };
	}
	if (
		(STANDALONE_FAMILIES as readonly string[]).includes(word) ||
		(UNSUPPORTED_GRAPH_FAMILIES as readonly string[]).includes(word)
	) {
		diagnostics.push({
			code: 'unsupported-family',
			message: `unsupported family "${line}"`,
			severity: 'error',
			span,
		});
		return { family: null, skipLine: true };
	}
	return { family: null, skipLine: false };
}

/**
 * Consume a directive line, returning true when the line was a directive.
 * Directives follow the reference precedence: legend rows while inside a
 * legend block, `}` closing a legend, `legend {` opening a block, then
 * `direction`, `kanban`, `title`, `colorMode`, and the `key: value` forms.
 * A `}` that is not inside a legend is left for group handling.
 */
function consumeDirective(
	state: GraphState,
	line: string,
	span: Span
): boolean {
	if (state.inLegend && !line.startsWith('}')) {
		const colon = findColon(line);
		if (colon) {
			state.legend.push({
				label: unquote(colon.value),
				swatch: unquote(colon.key),
			});
		} else {
			state.diagnostics.push({
				code: 'expected-colon',
				message: 'legend rows are `swatch: meaning`',
				severity: 'error',
				span,
			});
		}
		return true;
	}
	if (line.startsWith('}')) {
		if (state.inLegend) {
			state.inLegend = false;
			return true;
		}
		return false;
	}
	// Inline legend: `legend { green: ready, red: blocked }`.
	const inlineLegend = /^legend\s*\{([^}]*)\}\s*$/i.exec(line);
	if (inlineLegend) {
		for (const part of splitOn(inlineLegend[1] ?? '', ',')) {
			const item = part.trim();
			if (!item) {
				continue;
			}
			const colon = findColon(item);
			if (!colon) {
				state.diagnostics.push({
					code: 'expected-colon',
					message: 'legend entries are `swatch: meaning`',
					severity: 'error',
					span,
				});
				continue;
			}
			state.legend.push({
				label: unquote(colon.value),
				swatch: unquote(colon.key),
			});
		}
		return true;
	}
	if (/^legend\b.*\{$/i.test(line)) {
		state.inLegend = true;
		return true;
	}
	const directionWord = /^direction\s+(right|down|left|up)$/i.exec(line);
	if (directionWord) {
		state.direction = directionWord[1]?.toLowerCase() as
			| 'right'
			| 'down'
			| 'left'
			| 'up';
		return true;
	}
	if (/^kanban$/i.test(line)) {
		state.kanban = true;
		return true;
	}
	const titleWord = /^title\s+(\S.*)$/i.exec(line);
	if (titleWord && !state.title) {
		state.title = unquote(titleWord[1]?.trim() ?? '');
		return true;
	}
	const colorMode = /^colormode\b\s*:?\s*(.*)$/i.exec(line);
	if (colorMode) {
		const v = (colorMode[1] ?? '').trim().toLowerCase();
		const fill = resolveFill(v);
		if (fill === null) {
			state.diagnostics.push({
				code: 'unknown-attribute',
				message: `colorMode "${v}" is not supported (pastel, bold, outline)`,
				severity: 'warning',
				span,
			});
		} else {
			state.defaultFill = fill;
		}
		return true;
	}
	const keyed = /^(title|direction|icons)\s*:\s*(.+)$/i.exec(line);
	if (keyed) {
		const key = (keyed[1] ?? '').toLowerCase();
		const val = (keyed[2] ?? '').trim();
		if (key === 'title') {
			state.title = unquote(val);
		} else if (key === 'direction') {
			const v = val.toLowerCase();
			if (['down', 'right', 'up', 'left'].includes(v)) {
				state.direction = v as 'right' | 'down' | 'left' | 'up';
			} else {
				state.diagnostics.push({
					code: 'unknown-attribute',
					message: `direction "${val}" is not supported (right, down, left, up)`,
					severity: 'warning',
					span,
				});
			}
		} else {
			const v = val.toLowerCase();
			if (v === 'inside' || v === 'badge' || v === 'hanging') {
				state.icons = v === 'inside' ? 'inside' : 'badge';
			} else {
				state.diagnostics.push({
					code: 'unknown-attribute',
					message: `icons "${val}" is not supported (badge, inside)`,
					severity: 'warning',
					span,
				});
			}
		}
		return true;
	}
	return false;
}

/**
 * Assemble the final `GraphDiagram` from accumulated state: per-family
 * default shapes and direction, the `swimlanes` flag for bpmn, `variant`
 * for orgchart/statemachine, the colorMode default fill, and the optional
 * legend.
 */
function buildDiagram(state: GraphState): {
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
	variant?: 'orgchart' | 'statemachine';
} {
	const family = state.family ?? 'architecture';
	const isBlock =
		family === 'flowchart' || family === 'bpmn' || family === 'orgchart';
	for (const node of state.nodes) {
		if (family === 'statemachine') {
			const id = node.id.toLowerCase();
			const label = node.label.toLowerCase();
			const isStart =
				['[*]', 'start', 'begin', 'initial'].includes(id) ||
				['[*]', 'start', 'begin', 'initial'].includes(label);
			const isEnd =
				['end', 'final', 'stop', 'done'].includes(id) ||
				['end', 'final', 'stop', 'done'].includes(label);
			if (isStart) {
				node.shape ??= 'circle';
				node.fill ??= 'bold';
				node.color ??= 'gray';
			} else if (isEnd) {
				node.shape ??= 'double-circle';
			} else {
				node.shape ??= 'ellipse';
			}
		} else if (isBlock) {
			node.shape ??= 'rectangle';
		}
	}
	if (state.defaultFill) {
		for (const node of state.nodes) {
			node.fill ??= state.defaultFill;
		}
	}
	const diagram: {
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
		variant?: 'orgchart' | 'statemachine';
	} = {
		direction: state.direction ?? (isBlock ? 'down' : 'right'),
		edges: state.edges,
		groups: state.groups,
		kind: 'graph',
		nodes: state.nodes,
		title: state.title,
	};
	if (state.icons) {
		diagram.icons = state.icons;
	}
	if (family === 'bpmn') {
		diagram.swimlanes = true;
	}
	if (state.kanban) {
		diagram.kanban = true;
	}
	if (family === 'orgchart') {
		diagram.variant = 'orgchart';
	} else if (family === 'statemachine') {
		diagram.variant = 'statemachine';
	}
	if (state.legend.length > 0) {
		diagram.legend = state.legend;
	}
	return diagram;
}

/** Open a multi-line group: `group Name [attrs] {`. */
function parseGroupOpen(
	state: GraphState,
	groupStack: string[],
	line: string,
	lineNo: number,
	span: Span
): void {
	const { attrs, rest } = splitTrailingAttrs(line.replace(/\{\s*$/, ''));
	const a = parseAttrs(attrs ?? '', lineNo, rest.length + 2, state.diagnostics);
	const label = unquote(
		rest.replace(/^group\b/, '').trim() || `Group ${state.groups.length + 1}`
	);
	const parent = groupStack.at(-1);
	groupStack.push(getOrCreateGroup(state, label, parent, a, span));
}

/** Parse an inline group: `group Name { A, B }`. */
function parseInlineGroup(
	state: GraphState,
	groupStack: string[],
	line: string,
	lineNo: number,
	span: Span
): void {
	const m = /^group\b([^{]*)\{(.*)\}$/.exec(line);
	if (!m) {
		return;
	}
	const head = m[1] ?? '';
	const { attrs, rest } = splitTrailingAttrs(head);
	const a = parseAttrs(attrs ?? '', lineNo, rest.length + 2, state.diagnostics);
	const label = unquote(rest.trim() || `Group ${state.groups.length + 1}`);
	const parent = groupStack.at(-1);
	const gid = getOrCreateGroup(state, label, parent, a, span);
	for (const member of splitList(m[2] ?? '')) {
		const text = member.trim();
		if (!text) {
			continue;
		}
		const { attrs: memberAttrs, rest: memberRest } = splitTrailingAttrs(text);
		const ma = parseAttrs(
			memberAttrs ?? '',
			lineNo,
			span.start.column + memberRest.length + 2,
			state.diagnostics
		);
		const { id, name } = parseName(memberRest);
		if (!name) {
			continue;
		}
		getOrCreateNode(state, name, ma, id, span, gid);
	}
}

/** Arrow token classifiers: dotted/dashed style, reverse, bidirectional. */
const isDotted = (t: string) => t.includes('.') || t.includes('--');
const isBack = (t: string) =>
	t === '<-' || t === '<..' || t === '<--' || t === '<-.-' || t === '<';
const isBidirectional = (t: string) =>
	t === '<->' || t === '<..>' || t === '<-->' || t === '<-.->' || t === '<>';

/**
 * Parse an edge statement: `A -> B`, chains, fan-out/fan-in, labels, and a
 * trailing attribute block applied to the edges. `:` splits the statement
 * into head (nodes + connectors) and an optional label part whose own
 * trailing `[ … ]` block holds the edge attributes.
 */
function parseEdgeLine(
	state: GraphState,
	inGroup: string | undefined,
	line: string,
	lineNo: number
): void {
	const anchor = findConnector(line, ARROWS);
	if (!anchor) {
		return;
	}
	const colonIdx = findToken(line, ':', anchor.index + 1);
	const headText = colonIdx === -1 ? line : line.slice(0, colonIdx);
	let labelPart: string | undefined;
	let attrs: Attrs = {};
	if (colonIdx !== -1) {
		const after = line.slice(colonIdx + 1);
		const trimmed = after.trim();
		const leading = after.length - trimmed.length;
		const { attrs: a, rest } = splitTrailingAttrs(trimmed);
		labelPart = unquote(rest.trim()) || undefined;
		if (a !== null) {
			// The block's inner text starts at the value column after
			// `:`, the label, and the leading `[` (1-based column =
			// raw offset + 1).
			const blockStart = colonIdx + 1 + leading + rest.length + 2;
			attrs = parseAttrs(a, lineNo, blockStart, state.diagnostics);
		}
	}

	const h = scanHops(headText, ARROWS);
	if (!h) {
		return;
	}
	const lineSpan = spanAt(lineNo, 1, line.length);
	let sources = endpointNodes(state, h.first, 0, lineNo, inGroup, lineSpan);
	for (const hop of h.hops) {
		const targets = endpointNodes(
			state,
			hop.segment,
			hop.start,
			lineNo,
			inGroup,
			lineSpan
		);
		if (sources.length === 0 || targets.length === 0) {
			state.diagnostics.push({
				code: 'expected-node-name',
				message: 'edge needs both ends',
				severity: 'error',
				span: lineSpan,
			});
			return;
		}
		const back = isBack(hop.token);
		const dashed = isDotted(hop.token);
		const bidirectional = isBidirectional(hop.token);
		for (const a of sources) {
			for (const b of targets) {
				if (a === b) {
					state.diagnostics.push({
						code: 'self-edge',
						message: 'self-edges are not drawn',
						severity: 'warning',
						span: lineSpan,
					});
					continue;
				}
				const edge: Edge = { from: back ? b : a, to: back ? a : b };
				if (labelPart !== undefined) {
					edge.label = labelPart;
				}
				if (dashed) {
					edge.dashed = true;
				}
				if (bidirectional) {
					edge.bidirectional = true;
				}
				if (attrs.color) {
					edge.color = attrs.color;
				}
				if (attrs.flow) {
					edge.flow = true;
				}
				if (attrs.head) {
					edge.head = attrs.head;
				}
				if (attrs.invisible) {
					edge.invisible = true;
				}
				if (back) {
					edge.back = true;
				}
				state.edges.push(edge);
			}
		}
		sources = targets;
	}
}

/**
 * Resolve the nodes named by one comma-separated edge segment, auto-declaring
 * any node first seen here with a slugified id and the statement span.
 */
function endpointNodes(
	state: GraphState,
	segment: string,
	offset: number,
	lineNo: number,
	inGroup: string | undefined,
	span: Span
): string[] {
	const out: string[] = [];
	for (const { item, offset: itemOffset } of splitListOffsets(segment)) {
		const text = item.trim();
		if (!text) {
			continue;
		}
		// Use the raw item so `rest` keeps any leading whitespace,
		// matching the node-statement convention of `rest.length + 2`
		// for the first character after `[`.
		const { attrs, rest } = splitTrailingAttrs(item);
		if (attrs === null) {
			const { id, name } = parseName(text);
			if (!name) {
				continue;
			}
			// A declared group name used as an edge endpoint resolves to
			// the group id, matching node auto-declaration reserves.
			const groupId = state.groupByKey.get(name.toLowerCase());
			if (groupId !== undefined) {
				out.push(groupId);
				continue;
			}
			out.push(getOrCreateNode(state, name, {}, id, span, inGroup));
		} else {
			const a = parseAttrs(
				attrs,
				lineNo,
				offset + itemOffset + rest.length + 2,
				state.diagnostics
			);
			const { id, name } = parseName(rest.trim());
			if (!name) {
				continue;
			}
			out.push(getOrCreateNode(state, name, a, id, span, inGroup));
		}
	}
	return out;
}

/** Get-or-create a group by label; nested groups record their parent. */
function getOrCreateGroup(
	state: GraphState,
	label: string,
	parent: string | undefined,
	attrs: Attrs,
	span: Span
): string {
	const key = label.toLowerCase();
	const existing = state.groups.find((g) => g.label.toLowerCase() === key);
	if (existing) {
		return existing.id;
	}
	const id = uniqueId(slugify(label), state.usedIds);
	const group: Group = { id, label, span };
	if (attrs.color) {
		group.color = attrs.color;
	}
	if (attrs.icon) {
		group.icon = attrs.icon;
	}
	if (parent) {
		group.parent = parent;
	}
	state.groups.push(group);
	state.groupByKey.set(key, id);
	return id;
}

/**
 * Get-or-create a node by name (with optional explicit id), merging
 * attributes on redeclaration: earlier attributes are preserved, new ones
 * fill gaps, and the later label wins.
 */
function getOrCreateNode(
	state: GraphState,
	name: string,
	attrs: Attrs,
	id: string | undefined,
	span: Span,
	group?: string
): string {
	const keys = new Set<string>(
		[
			(id ?? name).toLowerCase(),
			name.toLowerCase(),
			attrs.label?.toLowerCase() ?? '',
		].filter(Boolean)
	);
	let existing: string | undefined;
	for (const k of keys) {
		const hit = state.nodeByKey.get(k);
		if (hit !== undefined) {
			existing = hit;
			break;
		}
	}
	if (existing) {
		const node = state.nodes.find((n) => n.id === existing);
		if (node) {
			if (group && !node.group) {
				node.group = group;
			}
			// Merge: earlier attributes are preserved, new ones fill gaps,
			// and the later label wins.
			node.icon ??= attrs.icon;
			node.shape ??= attrs.shape;
			node.color ??= attrs.color;
			node.fill ??= attrs.fill;
			node.corner ??= attrs.corner;
			node.labelColor ??= attrs.labelColor;
			if (attrs.shadow) {
				node.shadow = true;
			}
			node.link ??= attrs.link;
			if (attrs.label) {
				node.label = attrs.label;
			}
		}
		return existing;
	}
	const nid = uniqueId(id || slugify(name), state.usedIds);
	const node: Node = { id: nid, label: attrs.label ?? name, span };
	if (group) {
		node.group = group;
	}
	if (attrs.icon) {
		node.icon = attrs.icon;
	}
	if (attrs.shape) {
		node.shape = attrs.shape;
	}
	if (attrs.color) {
		node.color = attrs.color;
	}
	if (attrs.fill) {
		node.fill = attrs.fill;
	}
	if (attrs.corner) {
		node.corner = attrs.corner;
	}
	if (attrs.labelColor) {
		node.labelColor = attrs.labelColor;
	}
	if (attrs.shadow) {
		node.shadow = true;
	}
	if (attrs.link) {
		node.link = attrs.link;
	}
	state.nodes.push(node);
	for (const k of keys) {
		state.nodeByKey.set(k, nid);
	}
	return nid;
}

/** Parse an optional `id = Label` prefix off a name token. */
function parseName(text: string): { id?: string; name: string } {
	const i = findEquals(text);
	if (i === -1) {
		return { name: unquote(text) };
	}
	const key = text.slice(0, i).trim();
	const value = unquote(text.slice(i + 1));
	return /^[A-Za-z0-9_-]+$/.test(key)
		? { id: key.toLowerCase(), name: value }
		: { name: unquote(text) };
}

function findEquals(source: string): number {
	for (let i = 0; i < source.length; i += 1) {
		if (source[i] === '=') {
			return i;
		}
	}
	return -1;
}

/** Split a comma list into trimmed non-empty items (quote/bracket aware). */
function splitList(source: string): string[] {
	return source
		.split(',')
		.map((s) => s.trim())
		.filter((s) => s.length > 0);
}

/** Split a `key: value` item on the first `:` outside quotes/brackets. */
function findColon(source: string): { key: string; value: string } | null {
	const i = findToken(source, ':');
	if (i === -1) {
		return null;
	}
	return { key: source.slice(0, i).trim(), value: source.slice(i + 1).trim() };
}

/** A 1-based span covering `width` columns starting at `column`. */
function spanAt(line: number, column: number, width: number): Span {
	return {
		end: { column: column + Math.max(0, width - 1), line },
		start: { column, line },
	};
}
