import { describe, expect, test } from 'bun:test';
import type { Scene, SceneEdge, SceneNode } from '@kiyora/render';
import { sceneNode } from '@kiyora/render/testing';
import { boxContains, createEditor, moveNodes } from './editor';
import { MIN_NODE_HEIGHT, MIN_NODE_WIDTH } from './resize';
import { screenToWorld, worldToScreen } from './viewport';

const span = {
	end: { column: 2, line: 1 },
	start: { column: 1, line: 1 },
};

function sceneWithNodes(...nodes: Scene['nodes']): Scene {
	return { edges: [], groups: [], nodes, title: '' };
}

function sceneWith(edges: SceneEdge[], ...nodes: SceneNode[]): Scene {
	return { ...sceneWithNodes(...nodes), edges };
}

function nodeIds(scene: Scene): string[] {
	return scene.nodes.map(({ id }) => id);
}

function node(id: string, x: number, y = 0): Scene['nodes'][number] {
	return sceneNode({ height: 20, id, label: id, span, width: 20, x, y });
}

function edge(from: string, to: string): SceneEdge {
	return { from, span, to };
}

function nodeWithGroup(id: string, group: string, x = 0): SceneNode {
	return { ...node(id, x), group };
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

	test('keeps selection transient and coalesces a snapped drag into one history entry', () => {
		const editor = createEditor(
			sceneWithNodes(node('one', 0), node('two', 40))
		);
		editor.setViewport({ tx: 0, ty: 0, zoom: 1 });
		editor.select('one');
		editor.beginDrag('one');
		editor.drag(5, 3);
		editor.drag(5, 3);
		editor.endDrag();

		expect(editor.getScene().nodes[0]).toMatchObject({ x: 8, y: 8 });
		expect(editor.canUndo).toBe(true);
		editor.undo();
		expect(editor.getScene().nodes[0]).toMatchObject({ x: 0, y: 0 });
		expect(editor.getSelection()).toEqual(['one']);
		expect(editor.canUndo).toBe(false);
		editor.redo();
		expect(editor.getScene().nodes[0]).toMatchObject({ x: 8, y: 8 });
	});

	test('a single-node drag snaps to the 8-px screen-space grid', () => {
		const editor = createEditor(sceneWithNodes(node('one', 0)));
		editor.setViewport({ tx: 0, ty: 0, zoom: 1 });
		editor.beginDrag('one');
		editor.drag(3, 2);
		expect(editor.getScene().nodes[0]).toMatchObject({ x: 0, y: 0 });
		editor.drag(4, 1);
		expect(editor.getScene().nodes[0]).toMatchObject({ x: 8, y: 0 });
		editor.drag(0, 5);
		expect(editor.getScene().nodes[0]).toMatchObject({ x: 8, y: 8 });
		editor.drag(-1, 0);
		expect(editor.getScene().nodes[0]).toMatchObject({ x: 8, y: 8 });
		editor.endDrag();
		expect(editor.canUndo).toBe(true);
	});

	test('a multi-drag snaps the selection bounding box with one uniform delta', () => {
		const editor = createEditor(
			sceneWithNodes(node('one', 10, 0), node('two', 40, 20))
		);
		editor.setViewport({ tx: 0, ty: 0, zoom: 1 });
		editor.select('one');
		editor.toggleSelect('two');
		editor.beginDrag('two');
		editor.drag(5, 5);
		editor.endDrag();

		expect(editor.getScene().nodes.map(({ x, y }) => ({ x, y }))).toEqual([
			{ x: 16, y: 8 },
			{ x: 46, y: 28 },
		]);
	});

	test('snap converts the screen-space grid into world units at any zoom', () => {
		const editor = createEditor(sceneWithNodes(node('one', 10)));
		editor.setViewport({ tx: 0, ty: 0, zoom: 2 });
		editor.beginDrag('one');
		editor.drag(1, 0);
		editor.endDrag();

		expect(editor.getScene().nodes[0]).toMatchObject({ x: 12, y: 0 });
	});

	test('moves the complete selected set', () => {
		const editor = createEditor(
			sceneWithNodes(node('one', 0), node('two', 40))
		);
		editor.setViewport({ tx: 0, ty: 0, zoom: 1 });
		editor.select('one');
		editor.toggleSelect('two');
		editor.beginDrag('two');
		editor.drag(3, 4);
		editor.endDrag();

		expect(editor.getScene().nodes.map(({ x, y }) => ({ x, y }))).toEqual([
			{ x: 0, y: 8 },
			{ x: 40, y: 8 },
		]);
	});

	test('clears redo after a new committed edit and caps history at 200 entries', () => {
		const editor = createEditor(sceneWithNodes(node('one', 0)));
		editor.setViewport({ tx: 0, ty: 0, zoom: 1 });
		for (let index = 0; index < 201; index += 1) {
			editor.beginDrag('one');
			editor.drag(8, 0);
			editor.endDrag();
		}

		let undoCount = 0;
		while (editor.canUndo) {
			editor.undo();
			undoCount += 1;
		}
		expect(undoCount).toBe(200);
		expect(editor.getScene().nodes[0]?.x).toBe(8);
		expect(editor.canRedo).toBe(true);

		editor.beginDrag('one');
		editor.drag(8, 0);
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

	test('deleteSelection removes selected nodes and incident edges in one undoable entry', () => {
		const survivor = edge('one', 'three');
		const editor = createEditor(
			sceneWith(
				[edge('one', 'two'), edge('two', 'three'), survivor],
				node('one', 0),
				node('two', 40),
				node('three', 80)
			)
		);
		editor.select('two');

		editor.deleteSelection();

		expect(nodeIds(editor.getScene())).toEqual(['one', 'three']);
		expect(editor.getScene().edges).toEqual([survivor]);
		expect(editor.getSelection()).toEqual([]);
		expect(editor.canUndo).toBe(true);
		expect(editor.canRedo).toBe(false);

		editor.undo();
		expect(nodeIds(editor.getScene())).toEqual(['one', 'two', 'three']);
		expect(editor.getScene().edges).toHaveLength(3);
		expect(editor.canRedo).toBe(true);
		editor.redo();
		expect(nodeIds(editor.getScene())).toEqual(['one', 'three']);
	});

	test('copy and paste stamp a fresh cluster with new ids, offset, internal edges, and no group membership', () => {
		const editor = createEditor(
			sceneWith(
				[{ ...edge('one', 'two'), label: 'keeps style' }, edge('two', 'three')],
				nodeWithGroup('one', 'team', 0),
				nodeWithGroup('two', 'team', 40),
				node('three', 80)
			)
		);
		editor.select('one');
		editor.toggleSelect('two');
		editor.copy();
		editor.select(null);

		editor.paste();

		const scene = editor.getScene();
		expect(nodeIds(scene)).toEqual([
			'one',
			'two',
			'three',
			'one-copy',
			'two-copy',
		]);
		expect(scene.nodes[3]).toMatchObject({ x: 16, y: 16 });
		expect(scene.nodes[3]?.group).toBeUndefined();
		expect(scene.nodes[4]).toMatchObject({ x: 56, y: 16 });
		expect(scene.nodes[4]?.group).toBeUndefined();
		expect(scene.edges).toHaveLength(3);
		expect(scene.edges[2]).toMatchObject({
			from: 'one-copy',
			label: 'keeps style',
			to: 'two-copy',
		});
		expect(scene.nodes[0]).toMatchObject({ group: 'team' });
	});

	test('paste after copy without moving the selection re-derives ids against the whole scene', () => {
		const editor = createEditor(
			sceneWithNodes(nodeWithGroup('one', 'team'), node('one-copy', 90))
		);
		editor.select('one');
		editor.copy();
		editor.paste();
		editor.paste();

		expect(nodeIds(editor.getScene())).toEqual([
			'one',
			'one-copy',
			'one-copy-2',
			'one-copy-3',
		]);
	});

	test('cut is copy plus delete in one undoable entry and still pastes afterwards', () => {
		const editor = createEditor(
			sceneWith(
				[edge('one', 'two')],
				node('one', 0),
				node('two', 40),
				node('three', 80)
			)
		);
		editor.select('one');
		editor.toggleSelect('two');
		editor.cut();

		expect(nodeIds(editor.getScene())).toEqual(['three']);
		expect(editor.getScene().edges).toEqual([]);
		expect(editor.canUndo).toBe(true);

		editor.undo();
		expect(nodeIds(editor.getScene())).toEqual(['one', 'two', 'three']);
		expect(editor.getScene().edges).toEqual([edge('one', 'two')]);

		editor.redo();
		editor.paste();
		expect(nodeIds(editor.getScene())).toEqual([
			'three',
			'one-copy',
			'two-copy',
		]);
	});

	test('duplicate stamps the selection without touching the clipboard', () => {
		const editor = createEditor(
			sceneWithNodes(nodeWithGroup('one', 'team', 0), node('two', 40))
		);
		editor.select('one');
		editor.copy();
		editor.select('two');
		editor.duplicate();

		expect(nodeIds(editor.getScene())).toEqual(['one', 'two', 'two-copy']);
		expect(editor.canUndo).toBe(true);
		editor.undo();
		expect(nodeIds(editor.getScene())).toEqual(['one', 'two']);

		editor.select('two');
		editor.paste();
		expect(nodeIds(editor.getScene())).toEqual(['one', 'two', 'one-copy']);
	});

	test('structural edits with nothing to act on are no-ops that keep snapshot references stable', () => {
		const editor = createEditor(sceneWithNodes(node('one', 0)));
		const initial = editor.getSnapshot();
		let notifications = 0;
		const unsubscribe = editor.subscribe(() => {
			notifications += 1;
		});

		editor.deleteSelection();
		editor.copy();
		editor.cut();
		editor.paste();
		editor.duplicate();

		expect(editor.getSnapshot()).toBe(initial);
		expect(editor.canUndo).toBe(false);
		expect(notifications).toBe(0);
		unsubscribe();
	});

	test('each structural edit clears redo and commits one history entry', () => {
		const editor = createEditor(
			sceneWithNodes(node('one', 0), node('two', 40))
		);
		editor.setViewport({ tx: 0, ty: 0, zoom: 1 });
		editor.select('one');
		editor.beginDrag('one');
		editor.drag(4, 0);
		editor.endDrag();
		editor.undo();
		expect(editor.canRedo).toBe(true);

		editor.select('two');
		editor.deleteSelection();
		expect(editor.canRedo).toBe(false);

		editor.select('one');
		editor.copy();
		editor.paste();
		expect(editor.canRedo).toBe(false);

		editor.undo();
		expect(editor.canRedo).toBe(true);
		editor.duplicate();
		expect(editor.canRedo).toBe(false);
		expect(nodeIds(editor.getScene())).toEqual(['one', 'one-copy']);
	});

	test('the clipboard survives setScene while selection and history clear', () => {
		const editor = createEditor(sceneWithNodes(node('one', 0)));
		editor.select('one');
		editor.copy();
		editor.beginDrag('one');
		editor.drag(4, 0);
		editor.endDrag();

		editor.setScene(sceneWithNodes(node('replacement', 100)));

		expect(editor.getSelection()).toEqual([]);
		expect(editor.canUndo).toBe(false);
		editor.paste();
		expect(nodeIds(editor.getScene())).toEqual(['replacement', 'one-copy']);
	});

	test('selectMany replaces the selection, filtering unknown and duplicate ids', () => {
		const editor = createEditor(
			sceneWithNodes(node('one', 0), node('two', 40))
		);
		editor.select('one');

		editor.selectMany(['two', 'two', 'ghost', 'one']);
		expect(editor.getSelection()).toEqual(['two', 'one']);

		editor.selectMany(['ghost']);
		expect(editor.getSelection()).toEqual([]);
		expect(editor.canUndo).toBe(false);
	});

	test('a plain marquee selects every intersecting node in draw order and clears the rectangle', () => {
		const editor = createEditor(
			sceneWithNodes(node('one', 0), node('two', 40), node('three', 80))
		);
		editor.setViewport({ tx: 0, ty: 0, zoom: 1 });
		editor.select('three');

		editor.beginMarquee({ x: 5, y: 5 });
		editor.marqueeTo({ x: 50, y: 50 });
		expect(editor.getSnapshot().marquee).toEqual({
			x1: 5,
			x2: 50,
			y1: 5,
			y2: 50,
		});
		editor.endMarquee(false);

		expect(editor.getSelection()).toEqual(['one', 'two']);
		expect(editor.getSnapshot().marquee).toBeNull();
		expect(editor.canUndo).toBe(false);
	});

	test('a shift-marquee adds to the selection and a marquee over nothing clears it', () => {
		const editor = createEditor(
			sceneWithNodes(node('one', 0), node('two', 40), node('three', 80))
		);
		editor.setViewport({ tx: 0, ty: 0, zoom: 1 });
		editor.selectMany(['one']);

		editor.beginMarquee({ x: 85, y: 5 });
		editor.marqueeTo({ x: 95, y: 15 });
		editor.endMarquee(true);
		expect(editor.getSelection()).toEqual(['one', 'three']);

		editor.beginMarquee({ x: 200, y: 200 });
		editor.marqueeTo({ x: 240, y: 240 });
		editor.endMarquee(false);
		expect(editor.getSelection()).toEqual([]);
	});

	test('marquee coordinates are screen-space and respect zoom and pan', () => {
		const editor = createEditor(
			sceneWithNodes(node('one', 0), node('two', 40))
		);
		editor.setViewport({ tx: -20, ty: -20, zoom: 2 });

		editor.beginMarquee({ x: 0, y: 0 });
		editor.marqueeTo({ x: 20, y: 20 });
		editor.endMarquee(false);

		expect(editor.getSelection()).toEqual(['one']);
	});

	test('marquee selection touches edges and endMarquee without a marquee is a no-op', () => {
		const editor = createEditor(sceneWithNodes(node('one', 0)));
		editor.setViewport({ tx: 0, ty: 0, zoom: 1 });
		let notifications = 0;
		const unsubscribe = editor.subscribe(() => {
			notifications += 1;
		});

		editor.endMarquee(false);
		expect(notifications).toBe(0);

		editor.select('one');
		notifications = 0;
		editor.beginMarquee({ x: 20, y: 0 });
		editor.marqueeTo({ x: 30, y: 10 });
		editor.endMarquee(false);

		expect(editor.getSelection()).toEqual(['one']);
		unsubscribe();
	});

	test('cancelMarquee discards the rectangle without touching the selection', () => {
		const editor = createEditor(sceneWithNodes(node('one', 0)));
		editor.setViewport({ tx: 0, ty: 0, zoom: 1 });
		editor.select('one');
		editor.beginMarquee({ x: 200, y: 200 });
		editor.marqueeTo({ x: 300, y: 300 });

		editor.cancelMarquee();

		expect(editor.getSnapshot().marquee).toBeNull();
		expect(editor.getSelection()).toEqual(['one']);
	});

	test('setScene clears an in-flight marquee', () => {
		const editor = createEditor(sceneWithNodes(node('one', 0)));
		editor.setViewport({ tx: 0, ty: 0, zoom: 1 });
		editor.beginMarquee({ x: 0, y: 0 });
		editor.marqueeTo({ x: 10, y: 10 });

		editor.setScene(sceneWithNodes(node('replacement', 0)));

		expect(editor.getSnapshot().marquee).toBeNull();
		expect(editor.getSelection()).toEqual([]);
	});

	test('a nudge moves the selection by one world unit per press', () => {
		const editor = createEditor(
			sceneWithNodes(node('one', 10, 10), node('two', 40, 20))
		);
		editor.setViewport({ tx: 0, ty: 0, zoom: 1 });
		editor.selectMany(['one', 'two']);
		editor.beginNudge();
		editor.nudge('right', false);
		editor.nudge('right', false);
		editor.nudge('up', false);
		editor.endNudge();

		expect(editor.getScene().nodes.map(({ x, y }) => ({ x, y }))).toEqual([
			{ x: 12, y: 9 },
			{ x: 42, y: 19 },
		]);
	});

	test('a grid-step nudge converts the 8-px screen step at the current zoom', () => {
		const editor = createEditor(sceneWithNodes(node('one', 10)));
		editor.setViewport({ tx: 0, ty: 0, zoom: 2 });
		editor.select('one');
		editor.beginNudge();
		editor.nudge('right', true);
		editor.endNudge();

		expect(editor.getScene().nodes[0]).toMatchObject({ x: 14 });
	});

	test('a nudge run coalesces into one history entry', () => {
		const editor = createEditor(sceneWithNodes(node('one', 0)));
		editor.setViewport({ tx: 0, ty: 0, zoom: 1 });
		editor.select('one');
		editor.beginNudge();
		editor.nudge('right', false);
		editor.nudge('right', false);
		editor.nudge('down', true);
		editor.endNudge();

		expect(editor.getScene().nodes[0]?.x).toBe(2);
		expect(editor.canUndo).toBe(true);
		expect(editor.canRedo).toBe(false);
		editor.undo();
		expect(editor.getScene().nodes[0]?.x).toBe(0);
		expect(editor.canUndo).toBe(false);
		editor.redo();
		expect(editor.getScene().nodes[0]?.x).toBe(2);
	});

	test('a nudge with no live run or no selection is a no-op', () => {
		const editor = createEditor(sceneWithNodes(node('one', 0)));
		const initial = editor.getSnapshot();
		let notifications = 0;
		const unsubscribe = editor.subscribe(() => {
			notifications += 1;
		});

		editor.nudge('right', false);
		editor.endNudge();
		editor.beginNudge();
		editor.nudge('right', false);
		editor.endNudge();

		expect(editor.getSnapshot()).toBe(initial);
		expect(editor.canUndo).toBe(false);
		expect(notifications).toBe(0);
		unsubscribe();
	});

	test('undo and setScene abandon an in-flight nudge run', () => {
		const editor = createEditor(sceneWithNodes(node('one', 0)));
		editor.setViewport({ tx: 0, ty: 0, zoom: 1 });
		editor.select('one');
		editor.beginNudge();
		editor.nudge('right', false);
		editor.endNudge();

		editor.beginNudge();
		editor.nudge('right', false);
		editor.undo();
		editor.nudge('right', false);
		editor.endNudge();
		expect(editor.getScene().nodes[0]?.x).toBe(0);
		expect(editor.canRedo).toBe(true);

		editor.beginNudge();
		editor.nudge('right', false);
		editor.setScene(sceneWithNodes(node('replacement', 0)));
		editor.nudge('right', false);
		editor.endNudge();
		expect(nodeIds(editor.getScene())).toEqual(['replacement']);
		expect(editor.canUndo).toBe(false);
	});

	test('a structural edit commits the open nudge run before its own entry', () => {
		const editor = createEditor(
			sceneWithNodes(node('one', 0), node('two', 40))
		);
		editor.setViewport({ tx: 0, ty: 0, zoom: 1 });
		editor.select('one');
		editor.beginNudge();
		editor.nudge('right', false);

		editor.deleteSelection();

		expect(nodeIds(editor.getScene())).toEqual(['two']);
		editor.undo();
		expect(nodeIds(editor.getScene())).toEqual(['one', 'two']);
		expect(editor.getScene().nodes[0]?.x).toBe(1);
		editor.undo();
		expect(editor.getScene().nodes[0]?.x).toBe(0);
		expect(editor.canUndo).toBe(false);
	});

	test('beginDrag and beginResize commit the open nudge run', () => {
		const editor = createEditor(sceneWithNodes(node('one', 0)));
		editor.setViewport({ tx: 0, ty: 0, zoom: 1 });
		editor.select('one');
		editor.beginNudge();
		editor.nudge('right', false);
		editor.beginResize('one', 'e');

		expect(editor.getScene().nodes[0]?.x).toBe(1);
		editor.endResize();
		editor.undo();
		expect(editor.getScene().nodes[0]?.x).toBe(0);
		expect(editor.canUndo).toBe(false);

		editor.beginNudge();
		editor.nudge('right', false);
		editor.beginDrag('one');
		editor.endDrag();
		expect(editor.getScene().nodes[0]?.x).toBe(1);
		editor.undo();
		expect(editor.getScene().nodes[0]?.x).toBe(0);
		expect(editor.canUndo).toBe(false);
	});

	test('an east-handle resize mutates only width and anchors the west edge', () => {
		const editor = createEditor(
			sceneWithNodes(
				{ ...node('one', 100, 100), height: 60, width: 80 },
				node('two', 400, 100)
			)
		);
		editor.setViewport({ tx: 0, ty: 0, zoom: 1 });
		editor.beginResize('one', 'e');
		editor.resizeTo({ x: 220, y: 130 });
		editor.endResize();

		expect(editor.getScene().nodes[0]).toEqual({
			...node('one', 100, 100),
			height: 60,
			width: 120,
		});
		expect(editor.getScene().nodes[1]).toEqual(node('two', 400, 100));
	});

	test('a corner resize drags its anchor corner with clamped minimum size', () => {
		const editor = createEditor(
			sceneWithNodes({ ...node('one', 100, 100), height: 60, width: 80 })
		);
		editor.setViewport({ tx: 0, ty: 0, zoom: 1 });
		editor.beginResize('one', 'nw');
		editor.resizeTo({ x: 90, y: 95 });
		expect(editor.getScene().nodes[0]).toMatchObject({
			height: 65,
			width: 90,
			x: 90,
			y: 95,
		});
		editor.resizeTo({ x: 999, y: 999 });
		expect(editor.getScene().nodes[0]).toMatchObject({
			height: MIN_NODE_HEIGHT,
			width: MIN_NODE_WIDTH,
			x: 180 - MIN_NODE_WIDTH,
			y: 160 - MIN_NODE_HEIGHT,
		});
		editor.endResize();
	});

	test('a resize gesture coalesces into one history entry', () => {
		const editor = createEditor(
			sceneWithNodes({ ...node('one', 100, 100), height: 60, width: 80 })
		);
		editor.setViewport({ tx: 0, ty: 0, zoom: 1 });
		editor.beginResize('one', 'se');
		editor.resizeTo({ x: 190, y: 165 });
		editor.resizeTo({ x: 200, y: 170 });
		editor.endResize();

		expect(editor.getScene().nodes[0]).toMatchObject({
			height: 70,
			width: 100,
		});
		expect(editor.canUndo).toBe(true);
		expect(editor.canRedo).toBe(false);
		editor.undo();
		expect(editor.getScene().nodes[0]).toMatchObject({
			height: 60,
			width: 80,
			x: 100,
			y: 100,
		});
		expect(editor.canUndo).toBe(false);
		editor.redo();
		expect(editor.getScene().nodes[0]).toMatchObject({
			height: 70,
			width: 100,
		});
	});

	test('an unchanged resize gesture commits no history entry', () => {
		const editor = createEditor(
			sceneWithNodes({ ...node('one', 100, 100), height: 60, width: 80 })
		);
		editor.setViewport({ tx: 0, ty: 0, zoom: 1 });
		editor.beginResize('one', 'se');
		editor.resizeTo({ x: 180, y: 160 });
		editor.endResize();

		expect(editor.canUndo).toBe(false);
	});

	test('cancelResize restores the pre-gesture scene and records no history', () => {
		const editor = createEditor(
			sceneWithNodes({ ...node('one', 100, 100), height: 60, width: 80 })
		);
		editor.setViewport({ tx: 0, ty: 0, zoom: 1 });
		const before = editor.getScene();
		editor.beginResize('one', 'se');
		editor.resizeTo({ x: 200, y: 170 });
		expect(editor.getScene().nodes[0]).toMatchObject({
			height: 70,
			width: 100,
		});

		editor.cancelResize();

		expect(editor.getScene()).toBe(before);
		expect(editor.canUndo).toBe(false);
		expect(editor.canRedo).toBe(false);
		editor.resizeTo({ x: 300, y: 300 });
		editor.endResize();
		expect(editor.getScene()).toBe(before);
		expect(editor.canUndo).toBe(false);
	});

	test('resizeBy opens a keyboard resize run on the single selected node', () => {
		const editor = createEditor(
			sceneWithNodes({ ...node('one', 100, 100), height: 60, width: 80 })
		);
		editor.setViewport({ tx: 0, ty: 0, zoom: 1 });
		editor.select('one');

		expect(editor.resizeBy('right')).toBe(true);
		expect(editor.getScene().nodes[0]).toMatchObject({
			height: 60,
			width: 88,
			x: 100,
			y: 100,
		});
		expect(editor.canUndo).toBe(false);

		editor.endResize();
		expect(editor.canUndo).toBe(true);
		editor.undo();
		expect(editor.getScene().nodes[0]).toMatchObject({
			height: 60,
			width: 80,
		});
	});

	test('a resizeBy run coalesces into one history entry across directions', () => {
		const editor = createEditor(
			sceneWithNodes({ ...node('one', 100, 100), height: 60, width: 80 })
		);
		editor.setViewport({ tx: 0, ty: 0, zoom: 1 });
		editor.select('one');

		editor.resizeBy('right');
		editor.resizeBy('down');
		editor.resizeBy('right');
		editor.endResize();

		expect(editor.getScene().nodes[0]).toMatchObject({
			height: 68,
			width: 96,
		});
		expect(editor.canUndo).toBe(true);
		editor.undo();
		expect(editor.canUndo).toBe(false);
		expect(editor.getScene().nodes[0]).toMatchObject({
			height: 60,
			width: 80,
		});
	});

	test('resizeBy shrinks away from the direction and clamps to the minimum size', () => {
		const editor = createEditor(
			sceneWithNodes({ ...node('one', 100, 100), height: 60, width: 80 })
		);
		editor.setViewport({ tx: 0, ty: 0, zoom: 1 });
		editor.select('one');

		editor.resizeBy('right', true);
		expect(editor.getScene().nodes[0]).toMatchObject({
			height: 60,
			width: 72,
			x: 100,
		});
		for (let press = 0; press < 8; press += 1) {
			editor.resizeBy('right', true);
		}
		expect(editor.getScene().nodes[0]).toMatchObject({
			height: 60,
			width: MIN_NODE_WIDTH,
			x: 100,
		});
		editor.endResize();

		expect(editor.canUndo).toBe(true);
		editor.undo();
		expect(editor.getScene().nodes[0]).toMatchObject({
			height: 60,
			width: 80,
			x: 100,
		});
	});

	test('resizeBy ignores multi-selections, empty selections, and live drags', () => {
		const editor = createEditor(
			sceneWithNodes(node('one', 0), node('two', 40))
		);
		editor.setViewport({ tx: 0, ty: 0, zoom: 1 });
		const before = editor.getScene();

		expect(editor.resizeBy('right')).toBe(false);
		editor.selectMany(['one', 'two']);
		expect(editor.resizeBy('right')).toBe(false);
		editor.select('one');
		editor.beginDrag('one');
		expect(editor.resizeBy('right')).toBe(false);
		editor.endDrag();

		expect(editor.getScene()).toBe(before);
	});

	test('a resizeBy press commits an open nudge run first', () => {
		const editor = createEditor(sceneWithNodes(node('one', 0)));
		editor.setViewport({ tx: 0, ty: 0, zoom: 1 });
		editor.select('one');
		editor.beginNudge();
		editor.nudge('right', false);

		expect(editor.resizeBy('down')).toBe(true);
		editor.endResize();

		expect(editor.getScene().nodes[0]).toMatchObject({ height: 28, y: 0 });
		editor.undo();
		expect(editor.getScene().nodes[0]).toMatchObject({
			height: 20,
			x: 1,
			y: 0,
		});
		editor.undo();
		expect(editor.getScene().nodes[0]).toMatchObject({ x: 0, y: 0 });
	});

	test('cancelResize without a live gesture is a no-op', () => {
		const editor = createEditor(sceneWithNodes(node('one', 0)));
		const initial = editor.getSnapshot();
		let notifications = 0;
		const unsubscribe = editor.subscribe(() => {
			notifications += 1;
		});

		editor.cancelResize();

		expect(editor.getSnapshot()).toBe(initial);
		expect(editor.canUndo).toBe(false);
		expect(notifications).toBe(0);
		unsubscribe();
	});

	test('resize primitives without a live gesture are no-ops', () => {
		const editor = createEditor(sceneWithNodes(node('one', 0)));
		const initial = editor.getSnapshot();
		let notifications = 0;
		const unsubscribe = editor.subscribe(() => {
			notifications += 1;
		});

		editor.beginResize('ghost', 'se');
		editor.resizeTo({ x: 10, y: 10 });
		editor.endResize();

		expect(editor.getSnapshot()).toBe(initial);
		expect(editor.canUndo).toBe(false);
		expect(notifications).toBe(0);
		unsubscribe();
	});

	test('undo and setScene abandon an in-flight resize gesture', () => {
		const editor = createEditor(
			sceneWithNodes({ ...node('one', 100, 100), height: 60, width: 80 })
		);
		editor.setViewport({ tx: 0, ty: 0, zoom: 1 });
		editor.beginDrag('one');
		editor.drag(10, 0);
		editor.endDrag();

		editor.beginResize('one', 'se');
		editor.undo();
		editor.resizeTo({ x: 200, y: 170 });
		editor.endResize();
		expect(editor.getScene().nodes[0]).toMatchObject({ width: 80, x: 100 });
		expect(editor.canRedo).toBe(true);

		editor.beginResize('one', 'se');
		editor.setScene(sceneWithNodes(node('replacement', 0)));
		editor.resizeTo({ x: 200, y: 170 });
		editor.endResize();
		expect(nodeIds(editor.getScene())).toEqual(['replacement']);
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
