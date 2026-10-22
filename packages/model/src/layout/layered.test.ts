import { type GraphDiagram, parse } from '@kiyora/dsl';
import {
  type Bounds,
  LAYOUT_INSET,
  LAYOUT_NODE,
  layoutGraph,
  type NodePlacement,
} from '@kiyora/model';
import { describe, expect, it } from 'vitest';

const FRAME: Bounds = { h: 600, w: 800, x: 100, y: 100 };

const graph = (source: string): GraphDiagram => {
  const { diagram } = parse(source);
  if (diagram.kind !== 'graph') {
    throw new Error('the fixture is not a graph');
  }

  return diagram;
};

const layout = (source: string) => layoutGraph(graph(source), FRAME);

const node = (source: string, id: string): NodePlacement => {
  const found = layout(source).nodes.find((one) => one.id === id);
  if (found === undefined) {
    throw new Error(`no placement for ${id}`);
  }

  return found;
};

const overlaps = (a: Bounds, b: Bounds): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe('ranking a graph', () => {
  it('ranks a node by its longest path from a root', () => {
    const source = 'A -> B\nA -> C\nB -> D\nC -> D';

    expect(node(source, 'a').rank).toBe(0);
    expect(node(source, 'b').rank).toBe(1);
    expect(node(source, 'c').rank).toBe(1);
    expect(node(source, 'd').rank).toBe(2);
  });

  it('places each rank along the direction the source names', () => {
    const right = layout('direction right\nA -> B').nodes;
    const down = layout('direction down\nA -> B').nodes;
    const left = layout('direction left\nA -> B').nodes;
    const up = layout('direction up\nA -> B').nodes;

    const [aRight, bRight] = right;
    const [aDown, bDown] = down;
    const [aLeft, bLeft] = left;
    const [aUp, bUp] = up;

    expect(bRight?.x).toBeGreaterThan(aRight?.x ?? 0);
    expect(bRight?.y).toBe(aRight?.y);
    expect(bDown?.y).toBeGreaterThan(aDown?.y ?? 0);
    expect(bDown?.x).toBe(aDown?.x);
    expect(bLeft?.x).toBeLessThan(aLeft?.x ?? 0);
    expect(bLeft?.y).toBe(aLeft?.y);
    expect(bUp?.y).toBeLessThan(aUp?.y ?? 0);
    expect(bUp?.x).toBe(aUp?.x);
  });

  it('keeps the leading edge one inset inside the frame', () => {
    const right = layout('direction right\nA -> B').nodes;
    const down = layout('direction down\nA -> B').nodes;
    const left = layout('direction left\nA -> B').nodes;
    const up = layout('direction up\nA -> B').nodes;

    expect(right[0]?.x).toBe(FRAME.x + LAYOUT_INSET);
    expect(down[0]?.y).toBe(FRAME.y + LAYOUT_INSET);
    expect(Math.max(...left.map((one) => one.x + one.w))).toBe(
      FRAME.x + FRAME.w - LAYOUT_INSET
    );
    expect(Math.max(...up.map((one) => one.y + one.h))).toBe(
      FRAME.y + FRAME.h - LAYOUT_INSET
    );
  });

  it('uses the default node size and keeps every box inside the frame', () => {
    for (const direction of ['right', 'down', 'left', 'up'] as const) {
      const boxes = layout(`direction ${direction}\nA -> B`).nodes;

      for (const box of boxes) {
        expect(box.w).toBe(LAYOUT_NODE.w);
        expect(box.h).toBe(LAYOUT_NODE.h);
        expect(box.x).toBeGreaterThanOrEqual(FRAME.x + LAYOUT_INSET);
        expect(box.y).toBeGreaterThanOrEqual(FRAME.y + LAYOUT_INSET);
        expect(box.x + box.w).toBeLessThanOrEqual(
          FRAME.x + FRAME.w - LAYOUT_INSET
        );
        expect(box.y + box.h).toBeLessThanOrEqual(
          FRAME.y + FRAME.h - LAYOUT_INSET
        );
      }
    }
  });

  it('lays the same source out identically twice', () => {
    const source = 'direction right\nA -> B\nA -> C\nB -> D\nC -> D\nE';

    expect(layout(source)).toEqual(layout(source));
  });
});

describe('graphs that are not a clean DAG', () => {
  it('gives a cycle one rank rather than hanging or stacking its nodes', () => {
    const source = 'A -> B\nB -> C\nC -> A';
    const boxes = layout(source).nodes;

    expect(boxes.map((one) => one.rank)).toEqual([0, 0, 0]);
    expect(
      boxes.every((box, index) =>
        boxes.slice(index + 1).every((other) => !overlaps(box, other))
      )
    ).toBe(true);
  });

  it('ranks what leaves a cycle after the cycle', () => {
    const source = 'A -> B\nB -> A\nB -> C';

    expect(node(source, 'a').rank).toBe(0);
    expect(node(source, 'b').rank).toBe(0);
    expect(node(source, 'c').rank).toBe(1);
  });

  it('places a node with no edges on the first rank without overlapping', () => {
    const boxes = layout('direction down\nA\nB\nC').nodes;

    expect(boxes.map((one) => one.rank)).toEqual([0, 0, 0]);
    expect(boxes[0]?.x).not.toBe(boxes[1]?.x);
    expect(
      boxes.every((box, index) =>
        boxes.slice(index + 1).every((other) => !overlaps(box, other))
      )
    ).toBe(true);
  });
});

describe('groups in the source', () => {
  it('ranks a group edge against every member of the group', () => {
    const source = 'group Web { A, B }\nWeb -> C';

    expect(node(source, 'a').rank).toBe(0);
    expect(node(source, 'b').rank).toBe(0);
    expect(node(source, 'c').rank).toBe(1);
  });

  it('derives a group box from the nodes it holds', () => {
    const source = 'direction right\ngroup Web { A, B }\nWeb -> C';
    const result = layout(source);
    const box = result.groups.find((one) => one.id === 'web');
    const [a, b, c] = result.nodes;

    expect(box).toBeDefined();
    expect(box?.x).toBe(Math.min(a?.x ?? 0, b?.x ?? 0));
    expect(box?.x).toBeLessThanOrEqual(c?.x ?? 0);
  });
});
