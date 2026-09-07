import type { EntityField } from '@kiyora/dsl';
import { TEXT_PADDING } from './style';

export type LabelMetrics = {
	height: number;
	lineCount: number;
	lineHeight: number;
	lines: string[];
	width: number;
};

export type LabelMeasureOptions = {
	charWidth?: number;
	fontSize?: number;
	lineHeight?: number;
	maxWidth?: number;
	verticalPadding?: number;
};

const DEFAULT_CHAR_WIDTH = 0.58;
const DEFAULT_LINE_HEIGHT = 1.25;
const DEFAULT_MAX_WIDTH = 320;

/** Estimate a label's natural width without requiring a DOM or canvas. */
export function measureLabelWidth(
	label: string,
	fontSize = 16,
	charWidth = DEFAULT_CHAR_WIDTH
): number {
	const longestLine = Math.max(
		0,
		...label.split('\n').map((line) => line.length)
	);
	return longestLine * fontSize * charWidth;
}

/** Wrap words and hard-break overlong words so every line fits maxWidth. */
export function wrapLabel(
	label: string,
	maxWidth: number,
	fontSize = 16,
	charWidth = DEFAULT_CHAR_WIDTH
): string[] {
	const maxChars = Math.max(1, Math.floor(maxWidth / (fontSize * charWidth)));
	const lines: string[] = [];
	for (const paragraph of label.split('\n')) {
		const words = paragraph.split(/\s+/).filter(Boolean);
		if (words.length === 0) {
			lines.push('');
			continue;
		}
		let current = '';
		for (const word of words) {
			if (word.length > maxChars) {
				if (current) {
					lines.push(current);
					current = '';
				}
				for (let start = 0; start < word.length; start += maxChars) {
					const chunk = word.slice(start, start + maxChars);
					if (chunk.length === maxChars || start + maxChars >= word.length) {
						lines.push(chunk);
					}
				}
				continue;
			}
			const candidate = current ? `${current} ${word}` : word;
			if (candidate.length > maxChars && current) {
				lines.push(current);
				current = word;
			} else {
				current = candidate;
			}
		}
		if (current) {
			lines.push(current);
		}
	}
	return lines.length > 0 ? lines : [''];
}

/** Measure and wrap with the exact same heuristic used by label drawing. */
export function measureLabel(
	label: string,
	options: LabelMeasureOptions = {}
): LabelMetrics {
	const fontSize = options.fontSize ?? 16;
	const charWidth = options.charWidth ?? DEFAULT_CHAR_WIDTH;
	const lineHeight = options.lineHeight ?? fontSize * DEFAULT_LINE_HEIGHT;
	const maxWidth =
		options.maxWidth ??
		Math.min(
			DEFAULT_MAX_WIDTH,
			Math.max(fontSize * 4, measureLabelWidth(label, fontSize, charWidth))
		);
	const lines = wrapLabel(label, maxWidth, fontSize, charWidth);
	const width = Math.min(
		maxWidth,
		Math.max(
			fontSize * charWidth,
			...lines.map((line) => measureLabelWidth(line, fontSize, charWidth))
		)
	);
	return {
		height:
			lines.length * lineHeight + (options.verticalPadding ?? TEXT_PADDING * 2),
		lineCount: lines.length,
		lineHeight,
		lines,
		width,
	};
}

/** Format an entity field or method into a display label. */
export function formatEntityField(item: EntityField): string {
	return `${item.visibility ? `${item.visibility} ` : ''}${item.name}${item.type ? `: ${item.type}` : ''}`;
}
