import { parseAttrs } from './attributes';
import {
	findConnector,
	findToken,
	spanAt,
	splitOn,
	splitTrailingAttrs,
	stripComment,
	unquote,
} from './scan';
import type {
	ClassDiagram,
	Diagnostic,
	Entity,
	EntityField,
	Group,
	ParseResult,
	Relation,
	Span,
} from './types';
import {
	CARDINALITY,
	CLASS_ARROWS,
	CROWS,
	slugify,
	UML_RELATIONS,
	uniqueId,
} from './vocab';

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

type ClassState = {
	currentEntity: Entity | null;
	diagnostics: Diagnostic[];
	entities: Entity[];
	entityByKey: Map<string, string>;
	groupByKey: Map<string, string>;
	groupStack: string[];
	groups: Group[];
	relations: Relation[];
	usedIds: Set<string>;
};

function getOrCreateGroup(
	s: ClassState,
	label: string,
	attrs: { label?: string; color?: string; frame?: string },
	parent?: string,
	span?: Span
): string {
	const key = label.toLowerCase();
	const existing = s.groupByKey.get(key);
	if (existing) {
		return existing;
	}
	const id = uniqueId(slugify(label), s.usedIds);
	const group: Group = {
		id,
		label: attrs.label || label,
		span: span || {
			end: { column: 1, line: 1 },
			start: { column: 1, line: 1 },
		},
	};
	if (attrs.color) {
		group.color = attrs.color as never;
	}
	if (attrs.frame) {
		group.frame = attrs.frame;
	}
	if (parent && parent !== id) {
		group.parent = parent;
	}
	s.groups.push(group);
	s.groupByKey.set(key, id);
	return id;
}

function lookupEntity(s: ClassState, name: string): string | null {
	const direct = s.entityByKey.get(name.toLowerCase());
	if (direct) {
		return direct;
	}
	const dot = name.lastIndexOf('.');
	if (dot > 0) {
		return s.entityByKey.get(name.slice(0, dot).trim().toLowerCase()) ?? null;
	}
	return null;
}

export function parseClass(source: string): ParseResult {
	const state: ClassState = {
		currentEntity: null,
		diagnostics: [],
		entities: [],
		entityByKey: new Map(),
		groupByKey: new Map(),
		groupStack: [],
		groups: [],
		relations: [],
		usedIds: new Set(),
	};
	let title = '';
	let direction: ClassDiagram['direction'];

	const lines = source.split('\n');
	for (const [lineIndex, raw] of lines.entries()) {
		const rawLine = stripComment(raw).trim();
		if (!rawLine) {
			continue;
		}

		const lineNo = lineIndex + 1;
		const lineSpan = spanAt(lineNo, 1, rawLine.length);

		if (['class', 'erd', 'uml'].includes(rawLine.toLowerCase())) {
			continue;
		}

		if (state.currentEntity && rawLine === '}') {
			state.currentEntity = null;
			continue;
		}

		if (state.currentEntity) {
			const parts = splitOn(rawLine.replace(/,$/, ''), ' ')
				.map((t) => t.trim())
				.filter(Boolean);
			if (parts.length === 0) {
				continue;
			}

			const first = unquote(parts[0] || '');
			if (/^-{2,}$/.test(first) && parts.length === 1) {
				state.currentEntity.methods ??= [];
				continue;
			}

			const vis = /^([+\-#~])(.+)$/.exec(first);
			const visibility: EntityField['visibility'] = vis
				? (
						{
							'-': 'private',
							'#': 'protected',
							'+': 'public',
							'~': 'package',
						} as const
					)[vis[1] as '+' | '-' | '#' | '~']
				: undefined;
			const name = vis ? vis[2] || first : first;

			let type: string | undefined;
			let key: EntityField['key'];

			for (const token of parts.slice(1)) {
				const t = token.toLowerCase();
				if (t === 'pk' || t === 'fk') {
					key = t as 'pk' | 'fk';
				} else if (type) {
					state.diagnostics.push({
						code: 'unknown-attribute',
						message: `extra field token "${token}"`,
						severity: 'warning',
						span: lineSpan,
					});
				} else {
					type = token;
				}
			}

			const field: EntityField = { key, name, type, visibility };
			if (state.currentEntity.methods === undefined) {
				if (state.currentEntity.fields === undefined) {
					state.currentEntity.fields = [];
				}
				state.currentEntity.fields.push(field);
			} else {
				state.currentEntity.methods.push(field);
			}
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
			continue;
		}

		const dirMatch = /^direction\s+(right|down|left|up)$/i.exec(rawLine);
		if (dirMatch) {
			direction = dirMatch[1]?.toLowerCase() as ClassDiagram['direction'];
			continue;
		}

		if (rawLine === '}') {
			if (state.groupStack.length > 0) {
				state.groupStack.pop();
			} else {
				state.diagnostics.push({
					code: 'unmatched-block',
					message: 'unmatched }',
					severity: 'error',
					span: lineSpan,
				});
			}
			continue;
		}

		const groupMatch = /^group\b([^{]*)\{$/i.exec(rawLine);
		if (groupMatch) {
			const { attrs, rest } = splitTrailingAttrs(groupMatch[1]?.trim() || '');
			const a = parseAttrs(attrs ?? '', lineNo, 1, state.diagnostics);
			const label = unquote(rest) || `Group ${state.groups.length + 1}`;
			state.groupStack.push(
				getOrCreateGroup(state, label, a, state.groupStack.at(-1), lineSpan)
			);
			continue;
		}

		if (rawLine.endsWith('{') || /\{\s*\}$/.test(rawLine)) {
			const inline = /\{\s*\}$/.test(rawLine);
			const cleaned = rawLine.replace(/\{\s*\}?$/, '').trim();
			// Remove optional "class", "table", "entity" prefix
			const noKeyword = cleaned.replace(/^(class|table|entity)\s+/i, '').trim();

			const { attrs, rest } = splitTrailingAttrs(noKeyword);
			const a = parseAttrs(attrs ?? '', lineNo, 1, state.diagnostics);
			const { id, name } = parseName(rest);

			if (!name) {
				state.diagnostics.push({
					code: 'expected-node-name',
					message: 'table needs a name',
					severity: 'error',
					span: lineSpan,
				});
				continue;
			}

			const eid = uniqueId(id ?? slugify(name), state.usedIds);
			const entity: Entity = {
				id: eid,
				label: a.label ?? name,
				span: lineSpan,
			};
			if (a.color) {
				entity.color = a.color as never;
			}
			if (state.groupStack.length > 0) {
				entity.group = state.groupStack.at(-1);
			}

			state.entities.push(entity);
			state.entityByKey.set((id ?? name).toLowerCase(), eid);
			state.entityByKey.set(name.toLowerCase(), eid);

			if (!inline) {
				state.currentEntity = entity;
			}
			continue;
		}

		// Try to parse relation
		const anchor = findConnector(rawLine, CLASS_ARROWS);
		if (anchor) {
			const colonIdx = findToken(rawLine, ':', anchor.index + 1);
			const headText = colonIdx === -1 ? rawLine : rawLine.slice(0, colonIdx);
			let labelPart: string | undefined;
			if (colonIdx !== -1) {
				const after = rawLine.slice(colonIdx + 1).trim();
				labelPart = unquote(after) || undefined;
			}

			const connector = findConnector(headText, CLASS_ARROWS);
			if (connector) {
				const fromSegment = headText.slice(0, connector.index).trim();
				const toSegment = headText
					.slice(connector.index + connector.token.length)
					.trim();

				const fromName = unquote(fromSegment);
				const toName = unquote(toSegment);

				const fromId = lookupEntity(state, fromName);
				const toId = lookupEntity(state, toName);

				if (!(fromId && toId)) {
					state.diagnostics.push({
						code: 'expected-node-name',
						message: `relation references an undeclared table (${
							fromId ? toName : fromName
						})`,
						severity: 'error',
						span: lineSpan,
					});
					continue;
				}

				const { token } = connector;
				const crow = CROWS[token];
				const uml = UML_RELATIONS[token];
				const cardinality = CARDINALITY[token.toLowerCase()];
				const swap = uml?.swap ?? cardinality?.swap ?? false;

				const relation: Relation = {
					from: swap ? toId : fromId,
					span: lineSpan,
					to: swap ? fromId : toId,
				};

				if (cardinality) {
					relation.cardinality = cardinality.value;
				}
				if (crow) {
					relation.fromCard = crow.from;
					relation.toCard = crow.to;
					if (crow.identifying === false) {
						relation.identifying = false;
					}
				}
				if (uml) {
					relation.kind = uml.kind;
				}
				if (labelPart) {
					relation.label = labelPart;
				}
				if (token.includes('.') || token.includes('--')) {
					relation.dashed = true;
				}

				state.relations.push(relation);
				continue;
			}
		}

		state.diagnostics.push({
			code: 'expected-node-name',
			message: 'expected a table or relation',
			severity: 'error',
			span: lineSpan,
		});
	}

	if (state.currentEntity) {
		state.diagnostics.push({
			code: 'unclosed-block',
			message: 'unclosed table block',
			severity: 'warning',
			span: spanAt(lines.length, 1, 1),
		});
	}

	return {
		diagnostics: state.diagnostics,
		diagram: {
			direction,
			entities: state.entities,
			groups: state.groups,
			kind: 'class',
			relations: state.relations,
			title,
		},
	};
}
