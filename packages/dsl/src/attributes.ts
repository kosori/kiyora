/**
 * Attribute-block parsing for Kiyora DSL: a trailing `[ … ]` block is a
 * comma-separated list of positional or keyed (`key: value`) attributes.
 *
 * Positional attributes resolve against the vocabulary in a fixed order
 * (color, shape, fill, corner) and flags; keyed attributes apply by key.
 * Recognized-but-unresolvable tokens produce `unknown-color` / `unknown-shape`
 * warnings; unrecognized keys and unknown positional tokens produce
 * `unknown-attribute` warnings. `width`, `value`, and `score` parse but are
 * not carried — they produce an `attribute-ignored` warning, never a silent
 * drop.
 *
 * Diagnostics carry token-precise spans: `column` is the 1-based column of
 * the block's first character, and every token's offset within the raw block
 * text is tracked so warnings point at the exact source token.
 */

import { findToken, splitListOffsets, unquote } from './scan';
import type { Color, Corner, Diagnostic, Fill, Span } from './types';
import {
	resolveColor,
	resolveCorner,
	resolveFill,
	resolveShape,
	type Shape,
} from './vocab';

/** The node/edge style attributes a trailing `[ … ]` block can carry. */
export type Attrs = {
	color?: Color;
	corner?: Corner;
	fill?: Fill;
	flow?: boolean;
	group?: string;
	head?: string;
	icon?: string;
	invisible?: boolean;
	label?: string;
	labelColor?: Color;
	link?: string;
	score?: number;
	shadow?: boolean;
	shape?: Shape;
	value?: number;
	width?: number;
};

const IGNORED_KEYS = new Set<string>();

const FLAG_WORDS: Record<string, keyof Attrs> = {
	animated: 'flow',
	flow: 'flow',
	hidden: 'invisible',
	invisible: 'invisible',
	shadow: 'shadow',
};

/**
 * Parse the inner text of a `[ … ]` block (already split off the statement).
 * `column` is the 1-based column where the inner text starts, so diagnostic
 * spans point at the exact token.
 */
export function parseAttrs(
	raw: string,
	lineNo: number,
	column: number,
	diagnostics: Diagnostic[]
): Attrs {
	const out: Attrs = {};
	if (!raw || raw.trim() === '') {
		return out;
	}
	for (const { item, offset } of splitListOffsets(raw)) {
		const colon = findColon(item);
		if (!colon) {
			applyPositionalAttr(item, lineNo, column + offset, out, diagnostics);
			continue;
		}
		const key = colon.key.trim().toLowerCase();
		const value = unquote(colon.value.trim());
		const keyCol = column + offset + colon.keyOffset;
		const valueCol = column + offset + colon.valueOffset;
		const v = value.toLowerCase();
		switch (key) {
			case 'icon':
				out.icon = value;
				break;
			case 'labelcolor':
			case 'textcolor':
				applyResolved(
					out,
					'labelColor',
					value,
					v,
					lineNo,
					valueCol,
					diagnostics,
					'color'
				);
				break;
			case 'fill':
			case 'colormode':
				applyResolved(
					out,
					'fill',
					value,
					v,
					lineNo,
					valueCol,
					diagnostics,
					'fill'
				);
				break;
			case 'corner':
			case 'corners':
				applyResolved(
					out,
					'corner',
					value,
					v,
					lineNo,
					valueCol,
					diagnostics,
					'corner'
				);
				break;
			case 'group':
				out.group = value;
				break;
			case 'link':
			case 'href':
			case 'url':
				out.link = value || undefined;
				break;
			case 'width': {
				const cleaned = value.replace(/[^0-9.-]/g, '');
				const num = Number.parseFloat(cleaned);
				if (!Number.isNaN(num) && Number.isFinite(num)) {
					out.width = num;
				}
				break;
			}
			case 'score': {
				const cleaned = value.replace(/[^0-9.-]/g, '');
				const num = Number.parseFloat(cleaned);
				if (!Number.isNaN(num) && Number.isFinite(num)) {
					out.score = num;
				}
				break;
			}
			case 'value': {
				const cleaned = value.replace(/[^0-9.-]/g, '');
				const num = Number.parseFloat(cleaned);
				if (!Number.isNaN(num) && Number.isFinite(num)) {
					out.value = num;
				}
				break;
			}
			case 'head':
				out.head = value;
				break;
			case 'flow':
				out.flow = v !== 'false' && v !== '0';
				break;
			case 'color':
			case 'shape':
				applyResolved(out, key, value, v, lineNo, valueCol, diagnostics, key);
				break;
			default:
				if (IGNORED_KEYS.has(key)) {
					diagnostics.push({
						code: 'attribute-ignored',
						message: `attribute "${key}" is recognized but not supported in v1`,
						severity: 'warning',
						span: tokenSpan(lineNo, keyCol, key.length),
					});
				} else {
					diagnostics.push({
						code: 'unknown-attribute',
						message: `unknown attribute "${key}"`,
						severity: 'warning',
						span: tokenSpan(lineNo, keyCol, key.length),
					});
				}
		}
	}
	return out;
}

/** A 1-based span covering `width` columns starting at `column`. */
function tokenSpan(line: number, column: number, width: number): Span {
	return {
		end: { column: column + Math.max(0, width - 1), line },
		start: { column, line },
	};
}

/** Apply a resolved keyed attribute, warning when the token is unknown. */
function applyResolved(
	out: Attrs,
	key: keyof Attrs,
	value: string,
	lower: string,
	lineNo: number,
	column: number,
	diagnostics: Diagnostic[],
	kind: 'color' | 'fill' | 'corner' | 'shape'
): void {
	let resolved = false;
	if (kind === 'color') {
		const color = resolveColor(lower);
		if (color !== null) {
			if (key === 'color') {
				out.color = color;
			} else {
				out.labelColor = color;
			}
			resolved = true;
		}
	} else if (kind === 'fill') {
		const fill = resolveFill(lower);
		if (fill !== null) {
			out.fill = fill;
			resolved = true;
		}
	} else if (kind === 'corner') {
		const corner = resolveCorner(lower);
		if (corner !== null) {
			out.corner = corner;
			resolved = true;
		}
	} else {
		const shape = resolveShape(lower);
		if (shape !== null) {
			out.shape = shape;
			resolved = true;
		}
	}
	if (resolved) {
		return;
	}
	const code =
		kind === 'color'
			? 'unknown-color'
			: kind === 'shape'
				? 'unknown-shape'
				: 'unknown-attribute';
	const what = kind === 'color' ? 'color' : kind === 'shape' ? 'shape' : kind;
	diagnostics.push({
		code,
		message: `unknown ${what} "${value}"`,
		severity: 'warning',
		span: tokenSpan(lineNo, column, value.length),
	});
}

/** Apply a positional attribute to `out`, or warn when it is unknown. */
function applyPositionalAttr(
	item: string,
	lineNo: number,
	baseColumn: number,
	out: Attrs,
	diagnostics: Diagnostic[]
): void {
	const t = item.trim().toLowerCase();
	const leading = item.length - item.trimStart().length;
	const col = baseColumn + leading;
	const span = tokenSpan(lineNo, col, item.trim().length);
	const flag = FLAG_WORDS[t];
	if (flag === 'flow') {
		out.flow = true;
		return;
	}
	if (flag === 'invisible') {
		out.invisible = true;
		return;
	}
	if (flag === 'shadow') {
		out.shadow = true;
		return;
	}
	const color = resolveColor(t);
	if (color !== null) {
		out.color = color;
		return;
	}
	const shape = resolveShape(t);
	if (shape !== null) {
		out.shape = shape;
		return;
	}
	const fill = resolveFill(t);
	if (fill !== null) {
		out.fill = fill;
		return;
	}
	const corner = resolveCorner(t);
	if (corner !== null) {
		out.corner = corner;
		return;
	}
	// A quoted positional value is an icon name, not a style token.
	if (item.trim().startsWith('"')) {
		out.icon = unquote(item.trim());
		return;
	}
	diagnostics.push({
		code: 'unknown-attribute',
		message: `unknown attribute "${t}"`,
		severity: 'warning',
		span,
	});
}

/** Split a `key: value` item on the first `:` outside quotes/brackets. */
function findColon(source: string): {
	key: string;
	keyOffset: number;
	value: string;
	valueOffset: number;
} | null {
	const i = findToken(source, ':');
	if (i === -1) {
		return null;
	}
	const keyStart = source.slice(0, i).search(/\S/);
	const key = keyStart === -1 ? '' : source.slice(keyStart, i);
	const valueStart = i + 1;
	return {
		key: key.trim(),
		keyOffset: keyStart === -1 ? 0 : keyStart,
		value: source.slice(valueStart),
		valueOffset:
			valueStart +
			(source.slice(valueStart).length -
				source.slice(valueStart).trimStart().length),
	};
}
