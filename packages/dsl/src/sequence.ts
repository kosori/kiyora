/**
 * Sequence diagram statement parser.
 *
 * Line-oriented: blank lines and `//` comments are ignored.
 * The `sequence` header selects this parser. Directives such as `title`
 * configure diagram-level properties.
 */

import {
	findConnector,
	findToken,
	spanAt,
	stripComment,
	unquote,
} from './scan';
import type { Actor, Diagnostic, Message, ParseResult, Span } from './types';
import { ARROWS, slugify, uniqueId } from './vocab';

type MessageArrow = {
	dashed: boolean;
};

function parseMessageArrow(token: string): MessageArrow | null {
	if (token === '-->') {
		return { dashed: true };
	}
	if (token === '->') {
		return { dashed: false };
	}
	return null;
}

function parseName(text: string): { id?: string; name: string } {
	const i = findToken(text, '=');
	if (i === -1) {
		return { name: unquote(text) };
	}
	const left = text.slice(0, i).trim();
	const right = text.slice(i + 1).trim();
	return {
		id: left,
		name: unquote(right),
	};
}

type SequenceState = {
	actorByKey: Map<string, string>;
	actors: Actor[];
	usedIds: Set<string>;
};

function getOrCreateActor(
	state: SequenceState,
	name: string,
	id: string | undefined,
	span: Span
): string {
	const key = (id ?? name).toLowerCase();
	const existing =
		state.actorByKey.get(key) ?? state.actorByKey.get(name.toLowerCase());
	if (existing) {
		const existingActor = state.actors.find((actor) => actor.id === existing);
		if (existingActor && id !== undefined) {
			existingActor.label = name;
		}
		return existing;
	}
	const aid = uniqueId(id || slugify(name), state.usedIds);
	state.actors.push({
		id: aid,
		label: name,
		span,
	});
	state.actorByKey.set(key, aid);
	state.actorByKey.set(name.toLowerCase(), aid);
	state.actorByKey.set(aid.toLowerCase(), aid);
	return aid;
}

/** Parse Kira source as a sequence-family diagram. */
export function parseSequence(source: string): ParseResult {
	const diagnostics: Diagnostic[] = [];
	const state: SequenceState = {
		actorByKey: new Map(),
		actors: [],
		usedIds: new Set(),
	};
	const messages: Message[] = [];
	let title = '';

	const lines = source.split('\n');
	for (const [lineIndex, raw] of lines.entries()) {
		const rawLine = stripComment(raw).trim();
		if (!rawLine || rawLine.toLowerCase() === 'sequence') {
			continue;
		}

		const lineNo = lineIndex + 1;
		const lineSpan = spanAt(lineNo, 1, rawLine.length);

		const titleWord = /^title\s+(\S.*)$/i.exec(rawLine);
		if (titleWord && !title) {
			title = unquote(titleWord[1]?.trim() ?? '');
			continue;
		}

		const keyedTitle = /^title\s*:\s*(.+)$/i.exec(rawLine);
		if (keyedTitle && !title) {
			title = unquote(keyedTitle[1]?.trim() ?? '');
			continue;
		}

		const anchor = findConnector(rawLine, ARROWS);
		if (anchor) {
			const colonIdx = findToken(rawLine, ':', anchor.index + 1);
			const headText = colonIdx === -1 ? rawLine : rawLine.slice(0, colonIdx);
			let labelPart: string | undefined;
			if (colonIdx !== -1) {
				const after = rawLine.slice(colonIdx + 1).trim();
				labelPart = unquote(after) || undefined;
			}

			const connector = findConnector(headText, ARROWS);
			if (connector) {
				const arrow = parseMessageArrow(connector.token);
				if (!arrow) {
					// Reverse, bidirectional, or other unsupported arrows are dropped in MVP
					continue;
				}
				const fromSegment = headText.slice(0, connector.index).trim();
				const afterConnector = headText.slice(
					connector.index + connector.token.length
				);
				// Chained multi-hop messages (A -> B -> C: ping) are out of scope for MVP
				if (findConnector(afterConnector, ARROWS)) {
					continue;
				}
				const toSegment = afterConnector.trim();
				if (fromSegment && toSegment) {
					const fromId = getOrCreateActor(
						state,
						unquote(fromSegment),
						undefined,
						lineSpan
					);
					const toId = getOrCreateActor(
						state,
						unquote(toSegment),
						undefined,
						lineSpan
					);
					if (fromId === toId) {
						diagnostics.push({
							code: 'self-edge',
							message: 'self-edges are not drawn',
							severity: 'warning',
							span: lineSpan,
						});
						continue;
					}
					const message: Message = {
						from: fromId,
						span: lineSpan,
						to: toId,
					};
					if (labelPart !== undefined) {
						message.label = labelPart;
					}
					if (arrow.dashed) {
						message.dashed = true;
					}
					messages.push(message);
				}
			}
			continue;
		}

		if (/^actor\b/i.test(rawLine)) {
			const decl = rawLine.replace(/^actor\s*/i, '').trim();
			if (!decl) {
				diagnostics.push({
					code: 'expected-node-name',
					message: 'expected an actor name',
					severity: 'error',
					span: lineSpan,
				});
				continue;
			}
			const { id, name } = parseName(decl);
			if (name) {
				getOrCreateActor(state, name, id, lineSpan);
			}
			continue;
		}

		const eqIdx = findToken(rawLine, '=');
		if (eqIdx !== -1) {
			const { id, name } = parseName(rawLine);
			if (id && name) {
				getOrCreateActor(state, name, id, lineSpan);
			}
		}
	}

	return {
		diagnostics,
		diagram: {
			actors: state.actors,
			kind: 'sequence',
			messages,
			title,
		},
	};
}
