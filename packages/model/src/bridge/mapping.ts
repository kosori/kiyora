import { type Diagnostic, parse } from '@kiyora/dsl';
import type {
  ConnectorShape,
  FrameShape,
  GroupShape,
  Shape,
  Style,
} from '../board/schema';
import { nextId } from '../deck';
import { LAYOUT_INSET, layoutGraph } from '../layout/layered';
import type { Bounds } from '../paint/figures';
import { NOTE_STYLE } from '../paint/sticky';
import {
  edgeHeads,
  edgeStyle,
  figureOf,
  groupStyle,
  nodeStyle,
  SOURCE_ROUTE,
} from './vocabulary';

/** The gap a generated figure keeps from its frame's edges, in board units. */
export const SOURCE_INSET = LAYOUT_INSET;

/** What a Source produced: the shapes to stamp, and what the parser noticed. */
export type SourceMapping = {
  diagnostics: readonly Diagnostic[];
  shapes: readonly Shape[];
};

/** The box a connector falls back to when an end cannot be placed. */
const fallbackBox = (frame: Bounds): Bounds => ({
  h: 0,
  w: 0,
  x: frame.x,
  y: frame.y,
});

/** The footprint of a connector between the boxes of the shapes it joins. */
const connectorBox = (
  from: Bounds | undefined,
  to: Bounds | undefined,
  frame: Bounds
): Bounds => {
  if (from === undefined || to === undefined) {
    return fallbackBox(frame);
  }
  const x = Math.min(from.x, to.x);
  const y = Math.min(from.y, to.y);

  return {
    h: Math.max(from.y + from.h, to.y + to.h) - y,
    w: Math.max(from.x + from.w, to.x + to.w) - x,
    x,
    y,
  };
};

/**
 * Maps diagram source onto the shapes a frame holds: figures at the boxes the
 * layered layout gives them, a Group around each source group, and a Connector
 * bound to the shapes each edge joins. The AST is read and thrown away — only
 * the shapes it produced and its diagnostics leave here.
 *
 * A label is carried as its source text, never pre-wrapped: the paint walker
 * measures it with the same injected measurer a drawn label uses.
 *
 * Never throws: an empty or unreadable source maps to no shapes, and the frame
 * simply holds none of its own.
 */
export const mapSource = (
  source: string,
  frame: FrameShape,
  style: Style,
  existing: readonly Shape[]
): SourceMapping => {
  const { diagram, diagnostics } = parse(source);

  if (diagram.kind !== 'graph' || diagram.nodes.length === 0) {
    return { diagnostics, shapes: [] };
  }

  const layout = layoutGraph(diagram, frame);
  const boxes = new Map<string, Bounds>(
    [...layout.groups, ...layout.nodes].map((placement) => [
      placement.id,
      placement,
    ])
  );
  const used = new Set(existing.map((shape) => shape.id));

  const groupEntries = diagram.groups.map((group) => ({
    group,
    id: nextId('group', used),
  }));
  const groupIds = new Map(
    groupEntries.map((entry) => [entry.group.id, entry.id])
  );

  const groups: GroupShape[] = groupEntries.map(({ group, id }) => {
    const box = boxes.get(group.id) ?? fallbackBox(frame);

    return {
      h: box.h,
      id,
      kind: 'group',
      locked: false,
      opacity: 1,
      parentId:
        group.parent === undefined
          ? frame.id
          : (groupIds.get(group.parent) ?? frame.id),
      rotation: 0,
      style: groupStyle(style, group),
      w: box.w,
      x: box.x,
      y: box.y,
    };
  });

  const nodeEntries = diagram.nodes.map((node, index) => {
    const figure = figureOf(node.shape);
    const id = nextId(
      figure.kind === 'sticky' ? 'sticky' : figure.figure,
      used
    );

    return { figure, id, node, placement: layout.nodes[index] };
  });
  const nodeIds = new Map(
    nodeEntries.map((entry) => [entry.node.id, entry.id])
  );

  const nodes: Shape[] = nodeEntries.flatMap(
    ({ figure, id, node, placement }) => {
      if (placement === undefined) {
        return [];
      }
      const base = figure.kind === 'sticky' ? NOTE_STYLE : style;
      const common = {
        h: placement.h,
        id,
        locked: false,
        opacity: 1,
        parentId:
          node.group === undefined
            ? frame.id
            : (groupIds.get(node.group) ?? frame.id),
        rotation: 0,
        style: nodeStyle(base, node),
        text: node.label,
        w: placement.w,
        x: placement.x,
        y: placement.y,
      };

      return [
        figure.kind === 'sticky'
          ? { ...common, fit: 'auto' as const, kind: 'sticky' as const }
          : { ...common, kind: figure.figure },
      ];
    }
  );

  const connectors: ConnectorShape[] = diagram.edges.flatMap((edge) => {
    const fromId = nodeIds.get(edge.from) ?? groupIds.get(edge.from);
    const toId = nodeIds.get(edge.to) ?? groupIds.get(edge.to);
    if (fromId === undefined || toId === undefined) {
      return [];
    }
    const heads = edgeHeads(edge);
    const box = connectorBox(boxes.get(edge.from), boxes.get(edge.to), frame);

    return [
      {
        end: heads.end,
        from: { kind: 'bound', shapeId: fromId },
        h: box.h,
        id: nextId('connector', used),
        kind: 'connector',
        locked: false,
        opacity: edge.invisible === true ? 0 : 1,
        parentId: frame.id,
        rotation: 0,
        route: SOURCE_ROUTE,
        start: heads.start,
        style: edgeStyle(style, edge),
        ...(edge.label === undefined ? {} : { text: edge.label }),
        to: { kind: 'bound', shapeId: toId },
        w: box.w,
        x: box.x,
        y: box.y,
      },
    ];
  });

  return { diagnostics, shapes: [...groups, ...nodes, ...connectors] };
};
