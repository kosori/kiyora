import { parseAttrs } from './attributes';
import { splitTrailingAttrs, stripComment, unquote } from './scan';
import type { Diagnostic, MindMapBranch, ParseResult } from './types';
import { slugify } from './vocab';

const BRACKET_DELIMITER_OFFSET = 2;

type ParsedItem = {
	attrs: ReturnType<typeof parseAttrs>;
	indent: number;
	label: string;
	span: { column: number; line: number };
};

function createSpan(line: number, column: number, length: number) {
	return {
		end: { column: column + length, line },
		start: { column, line },
	};
}

function parseItemContent(
	content: string,
	contentStartCol: number,
	lineNo: number,
	indent: number,
	diagnostics: Diagnostic[]
): ParsedItem | null {
	const { attrs, rest } = splitTrailingAttrs(content);
	const rawLabel = rest.trim();
	const label = unquote(rawLabel);
	if (label.length === 0) {
		return null;
	}
	const attrCol =
		contentStartCol +
		content.length -
		(attrs ? attrs.length + BRACKET_DELIMITER_OFFSET : 0);
	const parsedAttrs = parseAttrs(attrs ?? '', lineNo, attrCol, diagnostics);
	return {
		attrs: parsedAttrs,
		indent,
		label,
		span: { column: contentStartCol, line: lineNo },
	};
}

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
	let centralAttrs: ReturnType<typeof parseAttrs> = {};
	let centralSpan = createSpan(1, 1, 0);
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
			const rawVal = meta[2].trim();
			if (key === 'title') {
				if (!title) {
					title = unquote(rawVal);
				}
				continue;
			}
			if (!central) {
				const { attrs, rest } = splitTrailingAttrs(rawVal);
				central = unquote(rest.trim());
				const valCol = line.indexOf(rawVal) + 1;
				const attrCol =
					valCol +
					rawVal.length -
					(attrs ? attrs.length + BRACKET_DELIMITER_OFFSET : 0);
				centralAttrs = parseAttrs(attrs ?? '', lineNo, attrCol, diagnostics);
				centralSpan = createSpan(lineNo, valCol, rawVal.length);
			}
			continue;
		}

		const itemMatch = line.match(/^(\s*)(?:[-*])\s+(.*)$/);
		if (itemMatch) {
			const [, indentStr, contentRaw] = itemMatch;
			if (indentStr === undefined || contentRaw === undefined) {
				continue;
			}
			const content = contentRaw.trim();
			const contentStartCol =
				indentStr.length + (line.slice(indentStr.length).indexOf(content) + 1);
			const item = parseItemContent(
				content,
				contentStartCol,
				lineNo,
				indentStr.length,
				diagnostics
			);
			if (item) {
				items.push(item);
			}
			continue;
		}

		if (!central) {
			const { attrs, rest } = splitTrailingAttrs(trimmedLine);
			central = unquote(rest.trim());
			const valCol = line.indexOf(trimmedLine) + 1;
			const attrCol =
				valCol +
				trimmedLine.length -
				(attrs ? attrs.length + BRACKET_DELIMITER_OFFSET : 0);
			centralAttrs = parseAttrs(attrs ?? '', lineNo, attrCol, diagnostics);
			centralSpan = createSpan(lineNo, valCol, trimmedLine.length);
			continue;
		}

		const col = line.indexOf(trimmedLine) + 1;
		const item = parseItemContent(trimmedLine, col, lineNo, 0, diagnostics);
		if (item) {
			items.push(item);
		}
	}

	const root: MindMapBranch = {
		children: [],
		color: centralAttrs.color,
		fill: centralAttrs.fill,
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
			span: createSpan(
				branchItem.span.line,
				branchItem.span.column,
				branchItem.label.length
			),
		};

		while (stack.length > 1) {
			const top = stack.at(-1);
			if (!top || branchItem.indent > top.indent) {
				break;
			}
			stack.pop();
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
