import { describe, expect, test } from 'bun:test';
import type { Scene } from '@kiyora/render';
import { boxContains, createEditor, moveNodes } from './editor';
import { screenToWorld, worldToScreen } from './viewport';

const span = {
	end: { column: 2, line: 1 },
	start: { column: 1, line: 1 },
};

function sceneWithNodes(...nodes: Scene['nodes']): Scene {
	return { edges: [], groups: [], nodes, title: '' };
}

function node(id: string, x: number, y = 0): Scene['nodes'][number] {
	return { height: 20, id, label: id, span, width: 20, x, y };
}

describe('editor', () => {
	test('hit-tests the topmost node and ignores empty space', () => {
		const bottom = node('bottom', 0);
		const top = node('top', 5);
		const editor = createEditor(sceneWithNodes(bottom, top));

		expect(editor.hitTest({ x: 10, y: 10 })).toBe(top);
		expect(editor.hitTest({ x: 100, y: 100 })).toBeNull();
		expect(editor.hitTest({ x: 0, y: 0 })).toBe(bottom);
	});

	test('moves only requested nodes and reuses other references', () => {
		const first = node('first', 0);
		const second = node('second', 40);
		const scene = sceneWithNodes(first, second);
		const moved = moveNodes(scene, ['first'], 10, 15);

		expect(moved).not.toBe(scene);
		expect(moved.nodes).not.toBe(scene.nodes);
		expect(moved.nodes[0]).not.toBe(first);
		expect(moved.nodes[0]).toMatchObject({ x: 10, y: 15 });
		expect(moved.nodes[1]).toBe(second);
		expect(scene.nodes[0]).toBe(first);
	});

	test('uses the initial scene placement for standalone coordinate transforms', () => {
		const item = node('item', 100, 80);
		const scene = { ...sceneWithNodes(item), title: 'Diagram' };
		const editor = createEditor(scene);
		const viewport = editor.getViewport();
		const painted = worldToScreen(viewport, {
			x: item.x + item.width / 2,
			y: item.y + item.height / 2,
		});

		expect(editor.hitTest(screenToWorld(viewport, painted))).toBe(item);
	});

	test('keeps snapshot references stable for no-op changes', () => {
		const editor = createEditor(sceneWithNodes(node('one', 0)));
		const initial = editor.getSnapshot();
		let notifications = 0;
		const unsubscribe = editor.subscribe(() => {
			notifications += 1;
		});

		editor.select(null);
		editor.panBy(0, 0);
		editor.setViewport(editor.getViewport());

		expect(editor.getSnapshot()).toBe(initial);
		expect(notifications).toBe(0);
		unsubscribe();
	});

	test('keeps selection transient and coalesces a drag into one history entry', () => {
		const editor = createEditor(
			sceneWithNodes(node('one', 0), node('two', 40))
		);
		editor.select('one');
		editor.beginDrag('one');
		editor.drag(5, 3);
		editor.drag(5, 3);
		editor.endDrag();

		expect(editor.getScene().nodes[0]).toMatchObject({ x: 10, y: 6 });
		expect(editor.canUndo).toBe(true);
		editor.undo();
		expect(editor.getScene().nodes[0]).toMatchObject({ x: 0, y: 0 });
		expect(editor.getSelection()).toEqual(['one']);
		expect(editor.canUndo).toBe(false);
		editor.redo();
		expect(editor.getScene().nodes[0]).toMatchObject({ x: 10, y: 6 });
	});

	test('moves the complete selected set', () => {
		const editor = createEditor(
			sceneWithNodes(node('one', 0), node('two', 40))
		);
		editor.select('one');
		editor.toggleSelect('two');
		editor.beginDrag('two');
		editor.drag(3, 4);
		editor.endDrag();

		expect(editor.getScene().nodes.map(({ x, y }) => ({ x, y }))).toEqual([
			{ x: 3, y: 4 },
			{ x: 43, y: 4 },
		]);
	});

	test('clears redo after a new committed edit and caps history at 200 entries', () => {
		const editor = createEditor(sceneWithNodes(node('one', 0)));
		for (let index = 0; index < 201; index += 1) {
			editor.beginDrag('one');
			editor.drag(1, 0);
			editor.endDrag();
		}

		let undoCount = 0;
		while (editor.canUndo) {
			editor.undo();
			undoCount += 1;
		}
		expect(undoCount).toBe(200);
		expect(editor.getScene().nodes[0]?.x).toBe(1);
		expect(editor.canRedo).toBe(true);

		editor.beginDrag('one');
		editor.drag(1, 0);
		editor.endDrag();
		expect(editor.canRedo).toBe(false);
	});

	test('does not treat a group as hittable and handles duplicate IDs by draw order', () => {
		const bottom = node('duplicate', 0);
		const top = node('duplicate', 50);
		const scene = sceneWithNodes(bottom, top);
		scene.groups.push({ id: 'group', label: 'Group', span });
		const editor = createEditor(scene);

		expect(
			boxContains({ height: 20, width: 20, x: 0, y: 0 }, { x: 10, y: 10 })
		).toBe(true);
		expect(editor.hitTest({ x: 10, y: 10 })).toBe(bottom);
		expect(editor.hitTest({ x: 60, y: 10 })).toBe(top);
		expect(editor.hitTest({ x: 25, y: 10 })).toBeNull();
	});

	test('setScene clears selection and history without recording viewport changes', () => {
		const first = sceneWithNodes(node('one', 0));
		const editor = createEditor(first);
		editor.select('one');
		editor.beginDrag('one');
		editor.drag(2, 0);
		editor.endDrag();
		editor.panBy(20, 30);
		const viewport = editor.getViewport();

		editor.setScene(sceneWithNodes(node('replacement', 100)));

		expect(editor.getSelection()).toEqual([]);
		expect(editor.canUndo).toBe(false);
		editor.undo();
		expect(editor.getScene().nodes[0]?.id).toBe('replacement');
		expect(editor.getViewport()).toEqual(viewport);
	});
});
