import { describe, expect, test } from 'bun:test';
import type { Scene } from '@kiyora/render';
import { sceneNode } from '@kiyora/render/testing';
import type { Event as HappyEvent } from 'happy-dom';
import { Window } from 'happy-dom';
import { createEditor } from './editor';
import { createEngine } from './engine';

const span = {
	end: { column: 2, line: 1 },
	start: { column: 1, line: 1 },
};

function makeScene(): Scene {
	return {
		edges: [],
		groups: [],
		nodes: [
			sceneNode({
				height: 40,
				id: 'node',
				label: 'Node',
				span,
				width: 80,
				x: 0,
				y: 0,
			}),
		],
		title: '',
	};
}

type PointerInit = {
	button?: number;
	clientX: number;
	clientY: number;
	pointerId?: number;
	shiftKey?: boolean;
};

function pointer(window: Window, type: string, init: PointerInit): HappyEvent {
	return new window.PointerEvent(type, {
		bubbles: true,
		button: 0,
		pointerId: 1,
		...init,
	}) as unknown as HappyEvent;
}

function asElement(element: unknown): HTMLElement {
	return element as HTMLElement;
}

describe('canvas engine', () => {
	test('mounts the product canvas with wobble overlays that never intercept pointers', () => {
		const window = new Window();
		const container = window.document.createElement('div');
		container.getBoundingClientRect = () => new window.DOMRect(0, 0, 400, 300);
		window.document.body.append(container);
		const editor = createEditor(makeScene());
		const engine = createEngine(asElement(container), editor);
		const overlays = container.querySelectorAll('[data-wobble="true"]');

		expect(overlays.length).toBeGreaterThan(0);
		for (const overlay of overlays) {
			expect(asElement(overlay).getAttribute('pointer-events')).toBe('none');
		}

		const overlayPaths = (): string[] =>
			[...container.querySelectorAll('[data-wobble="true"]')]
				.map((overlay) => asElement(overlay).getAttribute('d') ?? '')
				.filter((d) => d.length > 0);

		const base = makeScene();
		const initial = overlayPaths();
		expect(initial.length).toBeGreaterThan(0);
		expect(overlayPaths()).toEqual(initial);

		editor.setScene({
			...base,
			nodes: base.nodes.map((node) => ({ ...node, x: 4, y: 8 })),
		});
		const moved = overlayPaths();
		editor.setScene(base);
		const restored = overlayPaths();
		expect(moved).not.toEqual(initial);
		expect(restored).toEqual(initial);

		engine.destroy();
	});

	test('mounts, renders, and commits one history entry per node drag', () => {
		const window = new Window();
		const container = window.document.createElement('div');
		container.getBoundingClientRect = () => new window.DOMRect(0, 0, 400, 300);
		window.document.body.append(container);
		const editor = createEditor(makeScene());
		const engine = createEngine(asElement(container), editor);
		const svg = container.querySelector('svg');

		expect(svg).not.toBeNull();
		svg?.dispatchEvent(
			pointer(window, 'pointerdown', { clientX: 30, clientY: 30 })
		);
		svg?.dispatchEvent(
			pointer(window, 'pointermove', { clientX: 32, clientY: 32 })
		);
		svg?.dispatchEvent(
			pointer(window, 'pointermove', { clientX: 40, clientY: 45 })
		);
		svg?.dispatchEvent(
			pointer(window, 'pointerup', { clientX: 40, clientY: 45 })
		);

		expect(editor.getScene().nodes[0]).toMatchObject({ x: 8, y: 16 });
		expect(editor.canUndo).toBe(true);
		editor.undo();
		expect(editor.getScene().nodes[0]).toMatchObject({ x: 0, y: 0 });
		engine.destroy();
	});

	test('pans with the middle button and trackpad wheel, zooms with ctrl-wheel', () => {
		const window = new Window();
		const container = window.document.createElement('div');
		container.getBoundingClientRect = () => new window.DOMRect(0, 0, 400, 300);
		window.document.body.append(container);
		const editor = createEditor(makeScene());
		const engine = createEngine(asElement(container), editor);
		const svg = container.querySelector('svg');
		if (!svg) {
			throw new Error('engine did not mount an SVG');
		}

		const wheel = new window.WheelEvent('wheel', {
			bubbles: true,
			deltaY: -1,
		});
		Object.defineProperties(wheel, {
			clientX: { value: 100 },
			clientY: { value: 100 },
			ctrlKey: { value: true },
		});
		svg.dispatchEvent(wheel);
		expect(editor.getViewport().zoom).toBe(1.2);
		expect(editor.getViewport().tx).toBeCloseTo(8.8);
		expect(editor.getViewport().ty).toBeCloseTo(8.8);

		const trackpad = new window.WheelEvent('wheel', {
			bubbles: true,
			deltaX: -12,
			deltaY: -8,
		});
		svg.dispatchEvent(trackpad);
		expect(editor.getViewport().zoom).toBe(1.2);
		expect(editor.getViewport().tx).toBeCloseTo(20.8);
		expect(editor.getViewport().ty).toBeCloseTo(16.8);

		const lineWheel = new window.WheelEvent('wheel', {
			bubbles: true,
			deltaY: 3,
		});
		Object.defineProperty(lineWheel, 'deltaMode', { value: 1 });
		svg.dispatchEvent(lineWheel);
		expect(editor.getViewport().tx).toBeCloseTo(20.8);
		expect(editor.getViewport().ty).toBeCloseTo(16.8 - 48);

		svg.dispatchEvent(
			pointer(window, 'pointerdown', {
				button: 1,
				clientX: 10,
				clientY: 10,
			})
		);
		svg.dispatchEvent(
			pointer(window, 'pointermove', { clientX: 20, clientY: 25 })
		);
		svg.dispatchEvent(
			pointer(window, 'pointerup', { clientX: 20, clientY: 25 })
		);
		expect(editor.getViewport().tx).toBeCloseTo(30.8);
		expect(editor.getViewport().ty).toBeCloseTo(-16.2);
		engine.destroy();
	});

	test('destroy removes the SVG and detaches editor rendering', () => {
		const window = new Window();
		const container = window.document.createElement('div');
		container.getBoundingClientRect = () => new window.DOMRect(0, 0, 400, 300);
		window.document.body.append(container);
		const editor = createEditor(makeScene());
		const engine = createEngine(asElement(container), editor);
		const svg = container.querySelector('svg');
		engine.destroy();

		expect(container.querySelector('svg')).toBeNull();
		editor.select('node');
		expect(svg?.innerHTML).not.toContain('stroke="#4dabf7"');
		engine.destroy();
	});

	test('supports shift-click selection, space pan, and pointer-id gating', () => {
		const window = new Window();
		const container = window.document.createElement('div');
		container.getBoundingClientRect = () => new window.DOMRect(0, 0, 400, 300);
		window.document.body.append(container);
		const scene = makeScene();
		const [firstNode] = scene.nodes;
		if (!firstNode) {
			throw new Error('test scene did not include a node');
		}
		const editor = createEditor({
			...scene,
			nodes: [firstNode, { ...firstNode, id: 'second', x: 100 }],
		});
		const engine = createEngine(asElement(container), editor);
		const svg = container.querySelector('svg');
		if (!svg) {
			throw new Error('engine did not mount an SVG');
		}

		svg.dispatchEvent(
			pointer(window, 'pointerdown', {
				clientX: 35,
				clientY: 35,
				shiftKey: true,
			})
		);
		svg.dispatchEvent(
			pointer(window, 'pointerup', {
				clientX: 35,
				clientY: 35,
				shiftKey: true,
			})
		);
		expect(editor.getSelection()).toEqual(['node']);

		const initialViewport = editor.getViewport();
		window.dispatchEvent(
			new window.KeyboardEvent('keydown', { code: 'Space' })
		);
		svg.dispatchEvent(
			pointer(window, 'pointerdown', {
				clientX: 350,
				clientY: 250,
				pointerId: 2,
			})
		);
		svg.dispatchEvent(
			pointer(window, 'pointermove', {
				clientX: 352,
				clientY: 252,
				pointerId: 3,
			})
		);
		svg.dispatchEvent(
			pointer(window, 'pointermove', {
				clientX: 360,
				clientY: 260,
				pointerId: 2,
			})
		);
		svg.dispatchEvent(
			pointer(window, 'pointerup', {
				clientX: 360,
				clientY: 260,
				pointerId: 2,
			})
		);
		window.dispatchEvent(new window.KeyboardEvent('keyup', { code: 'Space' }));
		expect(editor.getViewport()).toEqual({
			...initialViewport,
			tx: initialViewport.tx + 10,
			ty: initialViewport.ty + 10,
		});
		engine.destroy();
	});

	test('a background drag draws a marquee and selects intersecting nodes instead of panning', () => {
		const window = new Window();
		const container = window.document.createElement('div');
		container.getBoundingClientRect = () => new window.DOMRect(0, 0, 400, 300);
		window.document.body.append(container);
		const scene = makeScene();
		const [firstNode] = scene.nodes;
		if (!firstNode) {
			throw new Error('test scene did not include a node');
		}
		const editor = createEditor({
			...scene,
			nodes: [firstNode, { ...firstNode, id: 'second', x: 100 }],
		});
		const engine = createEngine(asElement(container), editor);
		const svg = container.querySelector('svg');
		if (!svg) {
			throw new Error('engine did not mount an SVG');
		}
		editor.select('second');
		const viewportBefore = editor.getViewport();

		// Viewport starts at (24, 24): the marquee crosses 'node' only.
		svg.dispatchEvent(
			pointer(window, 'pointerdown', { clientX: 0, clientY: 0 })
		);
		svg.dispatchEvent(
			pointer(window, 'pointermove', { clientX: 5, clientY: 5 })
		);
		svg.dispatchEvent(
			pointer(window, 'pointermove', { clientX: 60, clientY: 60 })
		);
		expect(svg.innerHTML).toContain('fill="rgba(77,171,247,0.12)"');
		expect(editor.getViewport()).toEqual(viewportBefore);

		svg.dispatchEvent(
			pointer(window, 'pointerup', { clientX: 60, clientY: 60 })
		);
		expect(editor.getSelection()).toEqual(['node']);
		expect(svg.innerHTML).not.toContain('rgba(77,171,247,0.12)');

		// Multi-drag: the whole selection moves together.
		svg.dispatchEvent(
			pointer(window, 'pointerdown', { clientX: 30, clientY: 30 })
		);
		svg.dispatchEvent(
			pointer(window, 'pointermove', { clientX: 35, clientY: 35 })
		);
		svg.dispatchEvent(
			pointer(window, 'pointermove', { clientX: 42, clientY: 44 })
		);
		svg.dispatchEvent(
			pointer(window, 'pointerup', { clientX: 42, clientY: 44 })
		);
		expect(editor.getScene().nodes.map(({ x }) => x)).toEqual([16, 100]);
		engine.destroy();
	});

	test('a shift-marquee adds to the selection and a background click replaces it with none', () => {
		const window = new Window();
		const container = window.document.createElement('div');
		container.getBoundingClientRect = () => new window.DOMRect(0, 0, 400, 300);
		window.document.body.append(container);
		const scene = makeScene();
		const [firstNode] = scene.nodes;
		if (!firstNode) {
			throw new Error('test scene did not include a node');
		}
		const editor = createEditor({
			...scene,
			nodes: [firstNode, { ...firstNode, id: 'second', x: 100 }],
		});
		const engine = createEngine(asElement(container), editor);
		const svg = container.querySelector('svg');
		if (!svg) {
			throw new Error('engine did not mount an SVG');
		}
		editor.select('node');

		// Screen (150, 0) to (180, 50) crosses 'second' only.
		svg.dispatchEvent(
			pointer(window, 'pointerdown', {
				clientX: 150,
				clientY: 0,
				shiftKey: true,
			})
		);
		svg.dispatchEvent(
			pointer(window, 'pointermove', {
				clientX: 155,
				clientY: 5,
				shiftKey: true,
			})
		);
		svg.dispatchEvent(
			pointer(window, 'pointermove', {
				clientX: 180,
				clientY: 50,
				shiftKey: true,
			})
		);
		svg.dispatchEvent(
			pointer(window, 'pointerup', { clientX: 180, clientY: 50 })
		);
		expect(editor.getSelection()).toEqual(['node', 'second']);

		svg.dispatchEvent(
			pointer(window, 'pointerdown', { clientX: 350, clientY: 250 })
		);
		svg.dispatchEvent(
			pointer(window, 'pointerup', { clientX: 350, clientY: 250 })
		);
		expect(editor.getSelection()).toEqual([]);
		engine.destroy();
	});

	test('a handle drag resizes the node and commits one history entry', () => {
		const window = new Window();
		const container = window.document.createElement('div');
		container.getBoundingClientRect = () => new window.DOMRect(0, 0, 400, 300);
		window.document.body.append(container);
		const editor = createEditor(makeScene());
		const engine = createEngine(asElement(container), editor);
		const svg = container.querySelector('svg');
		if (!svg) {
			throw new Error('engine did not mount an SVG');
		}
		editor.select('node');

		// Viewport starts at (24, 24): the 80x40 node's 'se' handle sits on the
		// selection outline at screen (107, 67).
		expect(svg.innerHTML).toContain('data-resize-handle="se"');
		svg.dispatchEvent(
			pointer(window, 'pointerdown', { clientX: 107, clientY: 67 })
		);
		svg.dispatchEvent(
			pointer(window, 'pointermove', { clientX: 117, clientY: 77 })
		);
		expect(editor.getScene().nodes[0]).toMatchObject({
			height: 53,
			width: 93,
		});
		svg.dispatchEvent(
			pointer(window, 'pointerup', { clientX: 117, clientY: 77 })
		);
		expect(editor.canUndo).toBe(true);
		expect(editor.canRedo).toBe(false);
		editor.undo();
		expect(editor.getScene().nodes[0]).toMatchObject({
			height: 40,
			width: 80,
		});
		engine.destroy();
	});

	test('a cancelled resize drag restores the scene and records no history entry', () => {
		const window = new Window();
		const container = window.document.createElement('div');
		container.getBoundingClientRect = () => new window.DOMRect(0, 0, 400, 300);
		window.document.body.append(container);
		const editor = createEditor(makeScene());
		const engine = createEngine(asElement(container), editor);
		const svg = container.querySelector('svg');
		if (!svg) {
			throw new Error('engine did not mount an SVG');
		}
		editor.select('node');

		// The 'nw' handle at screen (21, 21) sits over the node's corner, so
		// handle detection must win against the plain node hit-test.
		svg.dispatchEvent(
			pointer(window, 'pointerdown', { clientX: 24, clientY: 24 })
		);
		svg.dispatchEvent(
			pointer(window, 'pointermove', { clientX: 4, clientY: 4 })
		);
		expect(editor.getScene().nodes[0]).not.toMatchObject({
			height: 40,
			width: 80,
		});
		svg.dispatchEvent(
			pointer(window, 'pointercancel', { clientX: 4, clientY: 4 })
		);
		expect(editor.getScene().nodes[0]).toMatchObject({
			height: 40,
			width: 80,
			x: 0,
			y: 0,
		});
		expect(editor.canUndo).toBe(false);
		expect(editor.canRedo).toBe(false);
		engine.destroy();
	});

	test('destroying mid-resize cancels the gesture and leaves history untouched', () => {
		const window = new Window();
		const container = window.document.createElement('div');
		container.getBoundingClientRect = () => new window.DOMRect(0, 0, 400, 300);
		window.document.body.append(container);
		const editor = createEditor(makeScene());
		const engine = createEngine(asElement(container), editor);
		const svg = container.querySelector('svg');
		if (!svg) {
			throw new Error('engine did not mount an SVG');
		}
		editor.select('node');

		svg.dispatchEvent(
			pointer(window, 'pointerdown', { clientX: 107, clientY: 67 })
		);
		svg.dispatchEvent(
			pointer(window, 'pointermove', { clientX: 117, clientY: 77 })
		);
		expect(editor.getScene().nodes[0]).not.toMatchObject({
			height: 40,
			width: 80,
		});
		engine.destroy();

		expect(editor.getScene().nodes[0]).toMatchObject({
			height: 40,
			width: 80,
			x: 0,
			y: 0,
		});
		expect(editor.canUndo).toBe(false);
		expect(editor.canRedo).toBe(false);
	});

	test('a cancelled marquee is discarded and shift can be pressed mid-drag', () => {
		const window = new Window();
		const container = window.document.createElement('div');
		container.getBoundingClientRect = () => new window.DOMRect(0, 0, 400, 300);
		window.document.body.append(container);
		const scene = makeScene();
		const [firstNode] = scene.nodes;
		if (!firstNode) {
			throw new Error('test scene did not include a node');
		}
		const editor = createEditor({
			...scene,
			nodes: [firstNode, { ...firstNode, id: 'second', x: 100 }],
		});
		const engine = createEngine(asElement(container), editor);
		const svg = container.querySelector('svg');
		if (!svg) {
			throw new Error('engine did not mount an SVG');
		}
		editor.select('second');

		svg.dispatchEvent(
			pointer(window, 'pointerdown', { clientX: 0, clientY: 0 })
		);
		svg.dispatchEvent(
			pointer(window, 'pointermove', { clientX: 60, clientY: 60 })
		);
		expect(editor.getSnapshot().marquee).not.toBeNull();
		svg.dispatchEvent(
			pointer(window, 'pointercancel', { clientX: 60, clientY: 60 })
		);
		expect(editor.getSnapshot().marquee).toBeNull();
		expect(editor.getSelection()).toEqual(['second']);

		// Shift pressed only at release still adds to the selection.
		svg.dispatchEvent(
			pointer(window, 'pointerdown', { clientX: 0, clientY: 0 })
		);
		svg.dispatchEvent(
			pointer(window, 'pointermove', { clientX: 60, clientY: 60 })
		);
		svg.dispatchEvent(
			pointer(window, 'pointerup', {
				clientX: 60,
				clientY: 60,
				shiftKey: true,
			})
		);
		expect(editor.getSelection()).toEqual(['second', 'node']);
		engine.destroy();
	});
});
