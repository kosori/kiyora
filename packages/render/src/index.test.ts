import { describe, expect, test } from 'bun:test';
import type { Diagram } from '@kiyora/dsl';
import { compile, render, renderToSvg } from './index';

const diagram: Diagram = {
	edges: [],
	groups: [],
	kind: 'graph',
	nodes: [],
	title: '',
};

describe('render scaffold', () => {
	test('compiles any diagram to an empty scene', () => {
		expect(compile(diagram)).toEqual({
			edges: [],
			groups: [],
			nodes: [],
			title: '',
		});
	});

	test('projects an empty scene to a valid SVG with default bounds', () => {
		expect(renderToSvg(compile(diagram))).toEqual({
			height: 48,
			svg: '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48" font-family="Balsamiq Sans Neue, cursive" data-node-font-size="16" data-edge-font-size="13"></svg>',
			width: 48,
		});
	});

	test('render combines compilation and SVG projection', () => {
		expect(render(diagram)).toEqual(renderToSvg(compile(diagram)));
	});
});
