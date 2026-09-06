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
	scanHops,
	spanAt,
	stripComment,
	unquote,
} from './scan';
import type { Actor, Diagnostic, Message, ParseResult, Span } from './types';
import { ARROWS, isBack, isDotted, slugify, uniqueId } from './vocab';

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

			const parsedHops = scanHops(headText, ARROWS);
			if (parsedHops && parsedHops.hops.length > 0) {
				let fromSegment = parsedHops.first.trim();
				for (const hop of parsedHops.hops) {
					const toSegment = hop.segment.trim();
					if (!(fromSegment && toSegment)) {
						continue;
					}
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
						fromSegment = toSegment;
						continue;
					}
					const back = isBack(hop.token);
					const dashed = isDotted(hop.token);
					const message: Message = {
						from: back ? toId : fromId,
						span: lineSpan,
						to: back ? fromId : toId,
					};
					if (labelPart !== undefined) {
						message.label = labelPart;
					}
					if (dashed) {
						message.dashed = true;
					}
					messages.push(message);
					fromSegment = toSegment;
				}
			}
			continue;
		}

		let decl = rawLine;
		if (/^actor\s+/i.test(decl)) {
			decl = decl.replace(/^actor\s+/i, '');
		}
		const { id, name } = parseName(decl);
		if (name) {
			getOrCreateActor(state, name, id, lineSpan);
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
