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
				return { attrs: t.slice(i + 1, -1), rest: t.slice(0, i) };
			}
		}
	}
	return { attrs: null, rest: line };
}
