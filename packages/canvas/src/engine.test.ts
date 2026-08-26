import { describe, expect, test } from 'bun:test';
import type { Scene } from '@kiyora/render';
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
			{
				height: 40,
				id: 'node',
				label: 'Node',
				span,
				width: 80,
				x: 0,
				y: 0,
			},
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

		expect(editor.getScene().nodes[0]).toMatchObject({ x: 10, y: 15 });
		expect(editor.canUndo).toBe(true);
		editor.undo();
		expect(editor.getScene().nodes[0]).toMatchObject({ x: 0, y: 0 });
		engine.destroy();
	});

	test('zooms to the wheel cursor and pans with the middle button', () => {
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
		});
		svg.dispatchEvent(wheel);
		expect(editor.getViewport().zoom).toBe(1.2);
		expect(editor.getViewport().tx).toBeCloseTo(8.8);
		expect(editor.getViewport().ty).toBeCloseTo(8.8);

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
		expect(editor.getViewport().tx).toBeCloseTo(18.8);
		expect(editor.getViewport().ty).toBeCloseTo(23.8);
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
});
