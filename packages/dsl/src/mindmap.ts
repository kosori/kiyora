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
const BRACKET_DELIMITER_OFFSET = 2;

type ParsedItem = {
	attrs: ReturnType<typeof parseAttrs>;
	indent: number;
	label: string;
	span: { column: number; line: number };
};

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
	let centralSpan = {
		end: { column: 1, line: 1 },
		start: { column: 1, line: 1 },
	};
	const items: ParsedItem[] = [];

	const lines = source.split('\n');
	for (const [index, raw] of lines.entries()) {
		const lineNo = index + 1;
		if (raw === undefined) {
			continue;
		}
		const line = stripComment(raw.replace(/\t/g, '  '));
		const trimmedLine = line.trim();
		if (trimmedLine.length === 0 || trimmedLine.toLowerCase() === 'mindmap') {
			continue;
		}

		const meta = /^(title|central|root|center)(?:\s*:\s*|\s+)(.*)$/i.exec(
			trimmedLine
		);
		if (meta && meta[1] !== undefined && meta[2] !== undefined) {
			const key = meta[1].toLowerCase();
			const directiveValue = unquote(meta[2].trim());
			if (key === 'title') {
				if (!title) {
					title = directiveValue;
				}
				continue;
			}
			if (!central) {
				central = directiveValue;
				const valCol = line.indexOf(directiveValue) + 1;
				centralSpan = {
					end: { column: valCol + directiveValue.length, line: lineNo },
					start: { column: valCol, line: lineNo },
				};
				continue;
			}
		}

		const itemMatch = line.match(/^(\s*)(?:[-*])\s+(.*)$/);
		if (itemMatch) {
			const [, indentStr, contentRaw] = itemMatch;
			if (indentStr !== undefined && contentRaw !== undefined) {
				const content = contentRaw.trim();
				const { attrs, rest } = splitTrailingAttrs(content);

				const contentStartCol =
					indentStr.length +
					(line.slice(indentStr.length).indexOf(content) + 1);
				const attrCol =
					contentStartCol +
					content.length -
					(attrs ? attrs.length + BRACKET_DELIMITER_OFFSET : 0);
				const parsedAttrs = parseAttrs(
					attrs ?? '',
					lineNo,
					attrCol,
					diagnostics
				);

				const label = unquote(rest.trim());
				if (label.length > 0) {
					items.push({
						attrs: parsedAttrs,
						indent: indentStr.length,
						label,
						span: { column: contentStartCol, line: lineNo },
					});
				}
				continue;
			}
		}

		if (central) {
			const col = line.indexOf(trimmedLine) + 1;
			const { attrs, rest } = splitTrailingAttrs(trimmedLine);
			const attrCol =
				col +
				trimmedLine.length -
				(attrs ? attrs.length + BRACKET_DELIMITER_OFFSET : 0);
			const parsedAttrs = parseAttrs(attrs ?? '', lineNo, attrCol, diagnostics);
			items.push({
				attrs: parsedAttrs,
				indent: 0,
				label: unquote(rest.trim()),
				span: { column: col, line: lineNo },
			});
		} else {
			const { rest } = splitTrailingAttrs(trimmedLine);
			central = unquote(rest.trim());
			const valCol = line.indexOf(central) + 1;
			centralSpan = {
				end: { column: valCol + central.length, line: lineNo },
				start: { column: valCol, line: lineNo },
			};
		}
	}

	const root: MindMapBranch = {
		children: [],
		id: slugify(central || title || 'central'),
		label: central || title || 'Central',
		span: centralSpan,
	};

	let branchId = 0;
	const stack: { children: MindMapBranch[]; indent: number }[] = [];
	stack.push({ children: root.children, indent: -1 });

	for (const branchItem of items) {
		branchId += 1;
		const node: MindMapBranch = {
			children: [],
			color: branchItem.attrs.color,
			fill: branchItem.attrs.fill,
			id: slugify(branchItem.label) || `b${branchId}`,
			label: branchItem.label,
			span: {
				end: {
					column: branchItem.span.column + branchItem.label.length,
					line: branchItem.span.line,
				},
				start: {
					column: branchItem.span.column,
					line: branchItem.span.line,
				},
			},
		};

		while (stack.length > 1) {
			const top = stack.at(-1);
			if (top && branchItem.indent <= top.indent) {
				stack.pop();
			} else {
				break;
			}
		}

		const parent = stack.at(-1);
		if (parent) {
			parent.children.push(node);
		}
		stack.push({ children: node.children, indent: branchItem.indent });
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
