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
	splitTrailingAttrs,
	stripComment,
	unquote,
} from './scan';
import type { Diagnostic, Edge, Group, Node, ParseResult, Span } from './types';
import { ARROWS, slugify, uniqueId } from './vocab';

type GraphState = {
	diagnostics: Diagnostic[];
	edges: Edge[];
	groups: Group[];
	groupByKey: Map<string, string>;
	nodes: Node[];
	nodeByKey: Map<string, string>;
	usedIds: Set<string>;
};

/** Parse Kira source as a graph-family diagram (v1 default family). */
export function parseGraph(source: string): ParseResult {
	const state: GraphState = {
		diagnostics: [],
		edges: [],
		groupByKey: new Map(),
		groups: [],
		nodeByKey: new Map(),
		nodes: [],
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
		diagram: {
			edges: state.edges,
			groups: state.groups,
			kind: 'graph',
			nodes: state.nodes,
			title: '',
		},
	};
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

/** A 1-based span covering `width` columns starting at `column`. */
function spanAt(line: number, column: number, width: number): Span {
	return {
		end: { column: column + Math.max(0, width - 1), line },
		start: { column, line },
	};
}
