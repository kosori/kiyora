/**
 * Sequence diagram statement parser.
 *
 * Line-oriented: blank lines and `//` comments are ignored.
 * The `sequence` header selects this parser. Directives such as `title`
 * configure diagram-level properties.
 */

import { stripComment, unquote } from './scan';
import type { Actor, Diagnostic, Message, ParseResult } from './types';

/** Parse Kira source as a sequence-family diagram. */
export function parseSequence(source: string): ParseResult {
	const diagnostics: Diagnostic[] = [];
	const actors: Actor[] = [];
	const messages: Message[] = [];
	let title = '';

	const lines = source.split('\n');
	for (const raw of lines) {
		const rawLine = stripComment(raw).trim();
		if (!rawLine || rawLine.toLowerCase() === 'sequence') {
			continue;
		}

		const titleWord = /^title\s+(\S.*)$/i.exec(rawLine);
		if (titleWord && !title) {
			title = unquote(titleWord[1]?.trim() ?? '');
			continue;
		}

		const keyedTitle = /^title\s*:\s*(.+)$/i.exec(rawLine);
		if (keyedTitle && !title) {
			title = unquote(keyedTitle[1]?.trim() ?? '');
		}
	}

	return {
		diagnostics,
		diagram: {
			actors,
			kind: 'sequence',
			messages,
			title,
		},
	};
}
