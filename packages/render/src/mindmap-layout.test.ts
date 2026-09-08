import { describe, expect, test } from 'bun:test';
import type { MindMapBranch } from '@kiyora/dsl';
import { layoutMindmap, measureBranch } from './mindmap-layout';

const span = {
	end: { column: 1, line: 1 },
	start: { column: 1, line: 1 },
};

describe('mindmap layout', () => {
	test('accumulates subtree horizontal width to encapsulate all descendants', () => {
		const tree: MindMapBranch = {
			children: [
				{
					children: [
						{
							children: [],
							id: 'leaf',
							label: 'Leaf Node',
							span,
						},
					],
					id: 'child',
					label: 'Child Node',
					span,
				},
			],
			id: 'root',
			label: 'Root Node',
			span,
		};

		const opts = {
			fontSize: 16,
			minHeight: 44,
			minWidth: 72,
			nodeGapX: 50,
			nodeGapY: 30,
			padding: 20,
		};

		const measured = measureBranch(tree, opts);
		expect(measured.subtreeWidth).toBeGreaterThan(measured.width);
		const [childMeasured] = measured.children;
		expect(childMeasured).toBeDefined();
		const [leafMeasured] = childMeasured?.children ?? [];
		expect(leafMeasured).toBeDefined();
		expect(childMeasured?.subtreeWidth).toBe(
			(childMeasured?.width ?? 0) + opts.nodeGapX + (leafMeasured?.width ?? 0)
		);
		expect(measured.subtreeWidth).toBe(
			measured.width + opts.nodeGapX + (childMeasured?.subtreeWidth ?? 0)
		);
	});

	test('lays out nodes with root and descendants correctly spaced', () => {
		const diagram = {
			kind: 'mindmap' as const,
			root: {
				children: [
					{
						children: [],
						id: 'child-1',
						label: 'Child 1',
						span,
					},
					{
						children: [],
						id: 'child-2',
						label: 'Child 2',
						span,
					},
				],
				id: 'root',
				label: 'Root',
				span,
			},
			title: 'Test Map',
		};

		const layout = layoutMindmap(diagram, { nodeGapX: 60, padding: 20 });
		const rootBox = layout.boxes.get('root');
		const child1Box = layout.boxes.get('child-1');
		const child2Box = layout.boxes.get('child-2');

		expect(rootBox).toBeDefined();
		expect(child1Box).toBeDefined();
		expect(child2Box).toBeDefined();

		expect(child1Box?.x).toBe((rootBox?.x ?? 0) + (rootBox?.width ?? 0) + 60);
		expect(child2Box?.x).toBe(child1Box?.x);
		expect(child2Box?.y ?? 0).toBeGreaterThan(child1Box?.y ?? 0);
	});
});
