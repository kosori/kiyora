import { describe, expect, test } from 'bun:test';
import {
	createEditor,
	createEngine,
	createViewport,
	fitToBounds,
	MAX_ZOOM,
	MIN_ZOOM,
	panBy,
	panTo,
	renderScene,
	resetView,
	screenToWorld,
	visibleWorld,
	worldToScreen,
	zoomAt,
} from './index';
import { canvasReactAdapter } from './react';

describe('canvas package scaffold', () => {
	test('exposes the core and viewport entry points', () => {
		expect(typeof createEditor).toBe('function');
		expect(typeof createEngine).toBe('function');
		expect(typeof renderScene).toBe('function');
		expect(typeof createViewport).toBe('function');
		expect(typeof fitToBounds).toBe('function');
		expect(typeof panBy).toBe('function');
		expect(typeof panTo).toBe('function');
		expect(typeof resetView).toBe('function');
		expect(typeof screenToWorld).toBe('function');
		expect(typeof visibleWorld).toBe('function');
		expect(typeof worldToScreen).toBe('function');
		expect(typeof zoomAt).toBe('function');
		expect(MIN_ZOOM).toBe(0.05);
		expect(MAX_ZOOM).toBe(8);
	});

	test('keeps the React subpath resolvable without core React code', () => {
		expect(canvasReactAdapter).toBe(true);
	});
});
