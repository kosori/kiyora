import { parseAttrs } from './attributes';
import { splitTrailingAttrs, stripComment, unquote } from './scan';
import type { Diagnostic, MindMapBranch, ParseResult } from './types';
import { slugify } from './vocab';

/**
 * Mindmap diagram statement parser.
 *
 * Line-oriented: blank lines and `//` comments are ignored.
 * The `mindmap` header selects this parser. Nodes are declared using
 * markdown list syntax (`- ` or `* `) with indentation defining the
 * tree hierarchy.
 */
export function parseMindmap(
	source: string,
	diagnostics: Diagnostic[] = []
): ParseResult {
	let title = '';
	let central = '';
	const items: {
		attrs: ReturnType<typeof parseAttrs>;
		indent: number;
		label: string;
		span: { column: number; line: number };
	}[] = [];

	const lines = source.split('\n');
	for (let i = 0; i < lines.length; i += 1) {
		const lineNo = i + 1;
		const raw = lines[i];
		if (raw === undefined) {
			continue;
		}
		const line = stripComment(raw.replace(/\t/g, '  '));
		const c = line.trim();
		if (c.length === 0 || c.toLowerCase() === 'mindmap') {
			continue;
		}

		const meta = /^(title|central|root|center)(?:\s*:\s*|\s+)(.*)$/i.exec(c);
		if (meta && meta[1] !== undefined && meta[2] !== undefined) {
			const key = meta[1].toLowerCase();
			const v = unquote(meta[2].trim());
			if (key === 'title') {
				if (!title) {
					title = v;
				}
				continue;
			}
			if (!central) {
				central = v;
				continue;
			}
		}

		const item = line.match(/^(\s*)[-*]\s+(.*)$/);
		if (item) {
			const [, indentStr, contentRaw] = item;
			if (indentStr !== undefined && contentRaw !== undefined) {
				const content = contentRaw.trim();
				const { attrs, rest } = splitTrailingAttrs(content);

				const col =
					indentStr.length +
					2 +
					content.length -
					(attrs ? attrs.length + 2 : 0);
				const a = parseAttrs(attrs ?? '', lineNo, col, diagnostics);

				const label = unquote(rest.trim());
				if (label.length > 0) {
					items.push({
						attrs: a,
						indent: indentStr.length,
						label,
						span: { column: indentStr.length + 1, line: lineNo },
					});
				}
				continue;
			}
		}

		if (central) {
			const col = line.indexOf(c) + 1;
			const { attrs, rest } = splitTrailingAttrs(c);
			const attrCol = col + c.length - (attrs ? attrs.length + 2 : 0);
			const a = parseAttrs(attrs ?? '', lineNo, attrCol, diagnostics);
			items.push({
				attrs: a,
				indent: 0,
				label: unquote(rest.trim()),
				span: { column: col, line: lineNo },
			});
		} else {
			const { rest } = splitTrailingAttrs(c);
			central = unquote(rest.trim());
		}
	}

	const root: MindMapBranch = {
		children: [],
		id: slugify(central || title || 'central'),
		label: central || title || 'Central',
		span: {
			end: { column: 1, line: 1 },
			start: { column: 1, line: 1 },
		},
	};

	let branchId = 0;
	const stack: { children: MindMapBranch[]; indent: number }[] = [];
	stack.push({ children: root.children, indent: -1 });

	for (const it of items) {
		branchId += 1;
		const node: MindMapBranch = {
			children: [],
			color: it.attrs.color,
			fill: it.attrs.fill,
			id: slugify(it.label) || `b${branchId}`,
			label: it.label,
			span: {
				end: { column: it.span.column + it.label.length, line: it.span.line },
				start: { column: it.span.column, line: it.span.line },
			},
		};

		while (stack.length > 1) {
			const top = stack.at(-1);
			if (top && it.indent <= top.indent) {
				stack.pop();
			} else {
				break;
			}
		}

		const parent = stack.at(-1);
		if (parent) {
			parent.children.push(node);
		}
		stack.push({ children: node.children, indent: it.indent });
	}

	return {
		diagnostics,
		diagram: {
			kind: 'mindmap',
			root,
			title,
		},
	};
}
