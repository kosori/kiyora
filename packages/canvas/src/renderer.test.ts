import { describe, expect, test } from 'bun:test';
import type { Scene } from '@kiyora/render';
import { createEditor } from './editor';
import { renderScene } from './renderer';

const span = {
	end: { column: 1, line: 1 },
	start: { column: 1, line: 1 },
};

function makeScene(): Scene {
	return {
		edges: [
			{
				color: 'red',
				dashed: true,
				from: 'source',
				head: 'arrow',
				label: 'go',
				span,
				to: 'target',
			},
		],
		groups: [{ id: 'group', label: 'Group', span }],
		legend: [{ label: 'Ready', swatch: 'green' }],
		nodes: [
			{
				color: 'blue',
				fill: 'pastel',
				group: 'group',
				height: 44,
				id: 'source',
				label: 'Source',
				span,
				width: 72,
				x: 50,
				y: 60,
			},
			{
				color: 'green',
				fill: 'bold',
				height: 44,
				id: 'target',
				label: 'Target',
				span,
				width: 72,
				x: 194,
				y: 60,
			},
		],
		title: 'Canvas',
	};
}

describe('renderScene', () => {
	test('renders the complete scene under the camera and preserves render geometry', () => {
		const editor = createEditor(makeScene());
		const svg = renderScene(editor.getSnapshot(), {
			height: 240,
			showGrid: false,
			width: 360,
		});

		expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
		expect(svg).toContain('width="360" height="240" viewBox="0 0 360 240"');
		expect(svg).toContain(
			'<g transform="translate(4 24) scale(1)" font-family="\'Balsamiq Sans Neue\', cursive">'
		);
		expect(svg).toContain('data-group="group"');
		expect(svg).toContain('data-edge="source-target"');
		expect(svg).toContain('data-node="source"');
		expect(svg).toContain('data-node="target"');
		expect(svg).toContain('data-legend="true"');
		expect(svg).toContain('Canvas');
		expect(svg).toContain('stroke-dasharray="4.5 6"');
		expect(svg).toContain('fill="#a5d8ff"');
		expect(svg).not.toContain('fill="#c8cdd4"');
	});

	test('draws a viewport-aligned grid and zoom-invariant selection chrome', () => {
		const editor = createEditor(makeScene());
		editor.setViewport({ tx: 10, ty: -8, zoom: 2 });
		editor.select('source');
		const svg = renderScene(editor.getSnapshot(), {
			height: 100,
			width: 160,
		});

		expect(svg).toContain('<rect width="160" height="100" fill="#fbfcfe"/>');
		expect(svg).toContain('cx="10" cy="-8" r="1.2" fill="#c8cdd4"');
		expect(svg).toContain('transform="translate(10 -8) scale(2)"');
		expect(svg).toContain(
			'stroke="#4dabf7" stroke-width="1.5" stroke-dasharray="4 3"'
		);
		expect(svg).toContain('x="107" y="109" width="150" height="94"');
	});

	test('can omit the grid without omitting the background', () => {
		const editor = createEditor(makeScene());
		const svg = renderScene(editor.getSnapshot(), {
			showGrid: false,
		});

		expect(svg).toContain('<rect width="294" height="212" fill="#fbfcfe"/>');
		expect(svg).not.toContain('fill="#c8cdd4"');
		expect(svg).toMatchSnapshot();
	});

	test('locks the complete projection as a golden SVG', () => {
		const editor = createEditor(makeScene());
		editor.setViewport({ tx: 12, ty: 18, zoom: 1.25 });
		editor.select('target');

		expect(
			renderScene(editor.getSnapshot(), {
				height: 240,
				width: 360,
			})
		).toMatchSnapshot();
	});
});
