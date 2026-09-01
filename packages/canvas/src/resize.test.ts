import { describe, expect, test } from 'bun:test';
import {
	handleHit,
	handleScreenCenter,
	MIN_NODE_HEIGHT,
	MIN_NODE_WIDTH,
	RESIZE_HANDLES,
	resizeBox,
} from './resize';
import { createViewport } from './viewport';

const box = { height: 40, width: 80, x: 100, y: 100 };

describe('resizeBox', () => {
	test('drags each edge and corner with the opposite side anchored', () => {
		expect(resizeBox(box, 'e', { x: 220, y: 130 })).toEqual({
			...box,
			width: 120,
		});
		expect(resizeBox(box, 'w', { x: 80, y: 130 })).toEqual({
			height: 40,
			width: 100,
			x: 80,
			y: 100,
		});
		expect(resizeBox(box, 's', { x: 140, y: 170 })).toEqual({
			...box,
			height: 70,
		});
		expect(resizeBox(box, 'n', { x: 140, y: 90 })).toEqual({
			height: 50,
			width: 80,
			x: 100,
			y: 90,
		});
		expect(resizeBox(box, 'se', { x: 200, y: 170 })).toEqual({
			height: 70,
			width: 100,
			x: 100,
			y: 100,
		});
		expect(resizeBox(box, 'nw', { x: 80, y: 90 })).toEqual({
			height: 50,
			width: 100,
			x: 80,
			y: 90,
		});
		expect(resizeBox(box, 'ne', { x: 200, y: 90 })).toEqual({
			height: 50,
			width: 100,
			x: 100,
			y: 90,
		});
		expect(resizeBox(box, 'sw', { x: 80, y: 170 })).toEqual({
			height: 70,
			width: 100,
			x: 80,
			y: 100,
		});
	});

	test('clamps width and height to the minimum node size', () => {
		expect(resizeBox(box, 'se', { x: 120, y: 110 })).toEqual({
			height: MIN_NODE_HEIGHT,
			width: MIN_NODE_WIDTH,
			x: 100,
			y: 100,
		});
		expect(resizeBox(box, 'nw', { x: 170, y: 150 })).toEqual({
			height: MIN_NODE_HEIGHT,
			width: MIN_NODE_WIDTH,
			x: 180 - MIN_NODE_WIDTH,
			y: 140 - MIN_NODE_HEIGHT,
		});
		expect(resizeBox(box, 'e', { x: 110, y: 130 })).toEqual({
			height: 40,
			width: MIN_NODE_WIDTH,
			x: 100,
			y: 100,
		});
		expect(resizeBox(box, 'w', { x: 170, y: 130 })).toEqual({
			height: 40,
			width: MIN_NODE_WIDTH,
			x: 140,
			y: 100,
		});
		expect(resizeBox(box, 's', { x: 140, y: 110 }).height).toBe(
			MIN_NODE_HEIGHT
		);
		expect(resizeBox(box, 'n', { x: 140, y: 150 })).toEqual({
			height: MIN_NODE_HEIGHT,
			width: 80,
			x: 100,
			y: 140 - MIN_NODE_HEIGHT,
		});
	});

	test('every handle is covered', () => {
		expect(RESIZE_HANDLES).toHaveLength(8);
	});
});

describe('handle chrome geometry', () => {
	test('anchors centers on the selection outline in screen space', () => {
		const viewport = { tx: 12, ty: 18, zoom: 2 };
		expect(handleScreenCenter(viewport, box, 'nw')).toEqual({
			x: 100 * 2 + 12 - 3,
			y: 100 * 2 + 18 - 3,
		});
		expect(handleScreenCenter(viewport, box, 'se')).toEqual({
			x: 180 * 2 + 12 + 3,
			y: 140 * 2 + 18 + 3,
		});
		expect(handleScreenCenter(viewport, box, 'n')).toEqual({
			x: (212 + 372) / 2,
			y: 100 * 2 + 18 - 3,
		});
		expect(handleScreenCenter(viewport, box, 'e')).toEqual({
			x: 180 * 2 + 12 + 3,
			y: (218 + 298) / 2,
		});
	});

	test('handleHit matches its own center within the handle square', () => {
		for (const handle of RESIZE_HANDLES) {
			const center = handleScreenCenter(createViewport(), box, handle);
			expect(handleHit(createViewport(), box, handle, center)).toBe(true);
			expect(
				handleHit(createViewport(), box, handle, {
					x: center.x + 5,
					y: center.y + 5,
				})
			).toBe(false);
		}
	});
});
