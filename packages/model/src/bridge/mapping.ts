import { type Diagnostic, parse, resolveShape } from '@kiyora/dsl';
import type {
  FigureKind,
  FigureShape,
  FrameShape,
  Shape,
  Style,
} from '../board/schema';
import { nextId } from '../deck';

/** The gap a generated figure keeps from its frame's edges, in board units. */
export const SOURCE_INSET = 24;

/** The box one generated figure takes until layout lands. */
const FIGURE = { h: 100, w: 160 } as const;

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
 * Maps diagram source onto the figures a frame holds. This is the tracer
 * bullet's deliberately small bridge: the parser's first node becomes one
 * figure, laid out at one inset inside the frame. The AST is read and thrown
 * away — only the shapes it produced and its diagnostics leave here.
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
  const node = diagram.kind === 'graph' ? diagram.nodes[0] : undefined;

  if (node === undefined) {
    return { diagnostics, shapes: [] };
  }

  const kind = figureKind(node.shape);
  const figure: FigureShape = {
    h: FIGURE.h,
    id: nextId(kind, new Set(existing.map((shape) => shape.id))),
    kind,
    locked: false,
    opacity: 1,
    parentId: frame.id,
    rotation: 0,
    style,
    text: node.label,
    w: FIGURE.w,
    x: frame.x + SOURCE_INSET,
    y: frame.y + SOURCE_INSET,
  };

  return { diagnostics, shapes: [figure] };
};
