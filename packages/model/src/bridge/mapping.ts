import { type Diagnostic, parse, resolveShape } from '@kiyora/dsl';
import type {
  FigureKind,
  FigureShape,
  FrameShape,
  Shape,
  Style,
} from '../board/schema';
import { nextId } from '../deck';
import { layoutGraph } from '../layout/layered';

/** What a Source produced: the figures to stamp, and what the parser noticed. */
export type SourceMapping = {
  diagnostics: readonly Diagnostic[];
  shapes: readonly FigureShape[];
};

/**
 * The figure a node's shape token names. The grammar's `sticky` is a shape kind
 * of its own rather than a figure, so a node asking for one lands as a
 * rectangle until the vocabulary mapping gives it a home.
 */
const figureKind = (token: string | undefined): FigureKind => {
  const resolved = token === undefined ? null : resolveShape(token);

  return resolved === null || resolved === 'sticky' ? 'rectangle' : resolved;
};

/**
 * Maps diagram source onto the figures a frame holds: one figure per node, at
 * the box the layered layout gives it. The AST is read and thrown away — only
 * the shapes it produced and its diagnostics leave here.
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
  const ids = new Set(existing.map((shape) => shape.id));
  const shapes: FigureShape[] = diagram.nodes.flatMap((node, index) => {
    const placement = layout.nodes[index];
    if (placement === undefined) {
      return [];
    }

    const kind = figureKind(node.shape);
    const id = nextId(kind, ids);

    return [
      {
        h: placement.h,
        id,
        kind,
        locked: false,
        opacity: 1,
        parentId: frame.id,
        rotation: 0,
        style,
        text: node.label,
        w: placement.w,
        x: placement.x,
        y: placement.y,
      },
    ];
  });

  return { diagnostics, shapes };
};
