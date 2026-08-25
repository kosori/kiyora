import { describe, expect, test } from 'bun:test';
import { FALLBACK_SHAPES, renderShape } from './shapes';
import { resolveStyle } from './style';

const box = { height: 60, width: 100, x: 10, y: 20 };
const style = resolveStyle('blue', 'pastel');
describe('shape geometry', () => {
	test.each([
		['ellipse', '<ellipse'],
		['circle', '<circle'],
		['double-circle', '<circle'],
		['diamond', 'M 60 20'],
		['triangle', 'M 60 20'],
		['hexagon', 'M 30 20'],
		['parallelogram', 'M 30 20'],
		['cylinder', '<ellipse'],
		['cloud', 'a '],
		['heart', 'C '],
		['star', 'M 60 20'],
		['bolt', 'M 68 20'],
		['note', 'L 110 36'],
		['sticky', 'L 110 36'],
		['speech-bubble', 'L 110 36'],
		['callout', 'L 110 36'],
		['document', 'C 85 80'],
		['actor', '<circle'],
		['checkbox', 'L 52 59.6'],
		['crossbox', 'L 82 63.199'],
		['plus', 'M 60 32'],
		['card', '<path d="M 96 20'],
		['delay', 'M 20 20 V 80'],
		['predefined-process', 'M 20 20 V 80'],
	] as const)('%s produces its distinct geometry', (kind, expected) => {
		const markup = renderShape(kind, box, style, 2);
		const fallback = renderShape('rectangle', box, style, 2);
		expect(markup).not.toBe(fallback);
		expect(markup).toContain(expected);
		expect(markup).toContain('stroke="#1e1e1e"');
	});

	test('uses rounded rectangle for every explicit fallback and unknown shape', () => {
		const fallback = renderShape('rectangle', box, style, 2);
		for (const kind of FALLBACK_SHAPES) {
			expect(renderShape(kind, box, style, 2)).toBe(fallback);
		}
		expect(renderShape('future-shape', box, style, 2)).toBe(fallback);
	});

	test('supports the legacy numeric call form', () => {
		expect(renderShape('diamond', 10, 20, 100, 60, style, 2)).toContain(
			'M 60 20'
		);
	});
});
