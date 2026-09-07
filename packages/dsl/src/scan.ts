/**
 * Line-scanner helpers for Kiyora DSL: quote/bracket-aware comment stripping,
 * token finding, splitting, unquoting, and trailing-attribute-block splitting.
 *
 * Every helper walks raw source and must not treat reserved characters
 * (`->`, `,`, `//`, `=`) inside quoted values or `[ … ]` attribute blocks as
 * syntax. Attribute brackets may nest.
 */

/**
 * Strip a `//` comment from the end of `line`. Occurrences inside quotes or
 * inside `[ … ]` blocks are left intact.
 */
export function stripComment(line: string): string {
	const i = findToken(line, '//');
	return i === -1 ? line : line.slice(0, i);
}

/**
 * Find `needle` in `source` at or after `from`, ignoring text inside quotes
 * and `[ … ]` attribute blocks. Returns the index, or `-1`.
 */
export function findToken(source: string, needle: string, from = 0): number {
	let inQuote = false;
	let depth = 0;
	for (let i = 0; i < source.length; i += 1) {
		const ch = source[i];
		if (ch === '"') {
			inQuote = !inQuote;
			continue;
		}
		if (!inQuote) {
			if (ch === '[') {
				depth += 1;
			} else if (ch === ']') {
				depth = Math.max(0, depth - 1);
			} else if (depth === 0 && i >= from && source.startsWith(needle, i)) {
				return i;
			}
		}
	}
	return -1;
}

/**
 * Split `source` on `delim`, respecting quotes and `[ … ]` blocks. Trailing
 * empty segments are preserved.
 */
export function splitOn(source: string, delim: string): string[] {
	const out: string[] = [];
	let depth = 0;
	let inQuote = false;
	let start = 0;
	for (let i = 0; i < source.length; i += 1) {
		const ch = source[i];
		if (ch === '"') {
			inQuote = !inQuote;
		} else if (!inQuote && ch === '[') {
			depth += 1;
		} else if (!inQuote && ch === ']') {
			depth = Math.max(0, depth - 1);
		} else if (!inQuote && depth === 0 && source.startsWith(delim, i)) {
			out.push(source.slice(start, i));
			i += delim.length - 1;
			start = i + 1;
		}
	}
	out.push(source.slice(start));
	return out;
}

/** Return a `"…"`-quoted value unquoted, otherwise return it trimmed. */
export function unquote(value: string): string {
	const t = value.trim();
	return t.length >= 2 && t.startsWith('"') && t.endsWith('"')
		? t.slice(1, -1)
		: t;
}

/**
 * Split a trailing `[ … ]` attribute block off a line.
 * Returns `{ rest, attrs }` where `attrs` is the block's inner text or `null`
 * when the line has no complete trailing block.
 */
export function splitTrailingAttrs(line: string): {
	attrs: string | null;
	rest: string;
} {
	const t = line.trimEnd();
	if (!t.endsWith(']')) {
		return { attrs: null, rest: line };
	}
	let depth = 0;
	let inQuote = false;
	for (let i = t.length - 1; i >= 0; i -= 1) {
		const ch = t[i];
		if (ch === '"') {
			inQuote = !inQuote;
		} else if (!inQuote && ch === ']') {
			depth += 1;
		} else if (!inQuote && ch === '[') {
			depth -= 1;
			if (depth === 0) {
				const attrs = t.slice(i + 1, -1);
				if (attrs.trim() === '*') {
					return { attrs: null, rest: line };
				}
				return { attrs, rest: t.slice(0, i) };
			}
		}
	}
	return { attrs: null, rest: line };
}

/**
 * Split a comma list into `{ item, offset }` pairs, keeping each item's raw
 * offset so spans stay token-precise after trimming.
 */
export function splitListOffsets(
	source: string
): { item: string; offset: number }[] {
	const out: { item: string; offset: number }[] = [];
	let cursor = 0;
	for (const part of splitOn(source, ',')) {
		const offset = source.indexOf(part, cursor);
		if (offset === -1) {
			break;
		}
		out.push({ item: part, offset });
		cursor = offset + part.length;
	}
	return out;
}

/**
 * The bare `>` token needs surrounding whitespace so `A>B` is not an edge;
 * every other connector token already starts with a non-word character.
 */
function padTokens(tokens: readonly string[]): string[] {
	return tokens.map((t) => (t === '>' ? ` ${t} ` : t));
}

/**
 * Find the first connector token in `source` at or after `from`, ignoring
 * text inside quotes and `[ … ]` blocks. Longer tokens win (so `<-.-` beats
 * `<-`); the bare `>` token additionally requires surrounding whitespace so
 * `A>B` is not an edge. Returns `null` when nothing matches.
 */
export function findConnector(
	source: string,
	tokens: readonly string[],
	from = 0
): { index: number; token: string } | null {
	const padded = padTokens(tokens);
	let inQuote = false;
	let depth = 0;
	for (let i = 0; i < source.length; i += 1) {
		const ch = source[i];
		if (ch === '"') {
			inQuote = !inQuote;
			continue;
		}
		if (inQuote) {
			continue;
		}
		if (ch === '[') {
			depth += 1;
			continue;
		}
		if (ch === ']') {
			depth = Math.max(0, depth - 1);
			continue;
		}
		if (depth > 0 || i < from) {
			continue;
		}
		for (let k = 0; k < padded.length; k += 1) {
			const pad = padded[k] ?? '';
			if (source.startsWith(pad, i)) {
				// Report the unpadded token position: for the bare `>`
				// (padded to ` > `) the match starts at the leading space.
				return {
					index: i + pad.indexOf(tokens[k] ?? ''),
					token: tokens[k] ?? '',
				};
			}
		}
	}
	return null;
}

/**
 * Split edge source text into its leading segment and one hop per connector:
 * `A -> B -> C` becomes first `A ` and hops `->` → ` B`, `->` → ` C`. Each
 * hop carries the raw `start` offset of its segment so attribute diagnostics
 * inside edge segments stay token-precise. Connectors inside quotes or
 * `[ … ]` blocks are not treated as hops. Returns `null` when the source
 * has no connector.
 */
export function scanHops(
	source: string,
	tokens: readonly string[]
): {
	first: string;
	hops: { segment: string; start: number; token: string }[];
} | null {
	const padded = padTokens(tokens);
	const hops: { segment: string; start: number; token: string }[] = [];
	let cursor = 0;
	let firstText: string | undefined;
	for (;;) {
		let found: { index: number; token: string } | null = null;
		let inQuote = false;
		let depth = 0;
		for (let o = cursor; o < source.length; o += 1) {
			const ch = source[o];
			if (ch === '"') {
				inQuote = !inQuote;
				continue;
			}
			if (inQuote) {
				continue;
			}
			if (ch === '[') {
				depth += 1;
				continue;
			}
			if (ch === ']') {
				depth = Math.max(0, depth - 1);
				continue;
			}
			if (depth > 0) {
				continue;
			}
			for (let k = 0; k < padded.length; k += 1) {
				if (source.startsWith(padded[k] ?? '', o)) {
					found = { index: o, token: tokens[k] ?? '' };
					break;
				}
			}
			if (found) {
				break;
			}
		}
		if (!found) {
			break;
		}
		const segment = source.slice(cursor, found.index);
		if (firstText === undefined) {
			firstText = segment;
		} else {
			const last = hops.at(-1);
			if (last) {
				last.segment = segment;
				last.start = cursor;
			}
		}
		const width = (padded[tokens.indexOf(found.token)] ?? '').length;
		hops.push({ segment: '', start: found.index + width, token: found.token });
		cursor = found.index + width;
	}
	if (firstText === undefined) {
		return null;
	}
	const last = hops.at(-1);
	if (last) {
		last.segment = source.slice(cursor);
		last.start = cursor;
	}
	return { first: firstText, hops };
}

/** Construct a Span from 1-based line, column, and length. */
export function spanAt(line: number, column: number, length: number) {
	return {
		end: { column: column + Math.max(0, length - 1), line },
		start: { column, line },
	};
}
