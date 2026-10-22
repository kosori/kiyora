import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { type GraphDiagram, parse } from '@kiyora/dsl';
import {
  type Bounds,
  LAYOUT_DIRECTIONS,
  type Layout,
  layoutGraph,
} from '@kiyora/model';
import { describe, expect, it } from 'vitest';

const FRAME: Bounds = { h: 600, w: 800, x: 100, y: 100 };

const SCENE = 'A -> B\nA -> C\nB -> D\nC -> D\nE';

const graphOf = (direction: string): GraphDiagram => {
  const { diagram } = parse(`direction ${direction}\n${SCENE}`);
  if (diagram.kind !== 'graph') {
    throw new Error('the fixture is not a graph');
  }

  return diagram;
};

const golden = (name: string): Layout =>
  JSON.parse(
    readFileSync(
      fileURLToPath(new URL(`./goldens/${name}`, import.meta.url)),
      'utf8'
    )
  ) as Layout;

describe('the layered layout', () => {
  for (const direction of LAYOUT_DIRECTIONS) {
    it(`matches the committed golden for a graph that flows ${direction}`, () => {
      expect(layoutGraph(graphOf(direction), FRAME)).toEqual(
        golden(`${direction}.json`)
      );
    });
  }

  it('produces the same boxes when the same source is laid out twice', () => {
    expect(layoutGraph(graphOf('right'), FRAME)).toEqual(
      layoutGraph(graphOf('right'), FRAME)
    );
  });
});
