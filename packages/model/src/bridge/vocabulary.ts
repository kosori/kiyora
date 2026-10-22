import {
  type Color,
  type Edge,
  type Fill,
  type Group,
  type Node,
  resolveColor,
  resolveCorner,
  resolveFill,
  resolveHead,
  resolveShape,
  type Corner as SourceCorner,
} from '@kiyora/dsl';
import type { FigureKind, Head, Route } from '../board/schema';
import type { Style } from '../board/shape-base';

/**
 * The bridge's vocabulary: the parser's words to the board's shapes and style.
 * Every token resolves through the grammar's own helpers, so a figure the shape
 * picker offers and a figure the source names cannot disagree.
 */

/** What a source figure token becomes: a plain figure, or the note kind. */
export type SourceFigure =
  | { figure: FigureKind; kind: 'figure' }
  | { kind: 'sticky' };

/**
 * The board shape a source figure token names. The board's figure kinds are the
 * grammar's shape list less `sticky`, which is a shape kind of its own, so the
 * mapping is the vocabulary rather than a second list beside it.
 */
export const figureOf = (token: string | undefined): SourceFigure => {
  const shape =
    token === undefined ? 'rectangle' : (resolveShape(token) ?? 'rectangle');

  return shape === 'sticky'
    ? { kind: 'sticky' }
    : { figure: shape, kind: 'figure' };
};

/** A palette colour resolved from a source token, or the fallback. */
const colourOf = (
  token: Color | undefined,
  fallback: Style['fill']
): Style['fill'] => resolveColor(token ?? '') ?? fallback;

/** A fill style resolved from a source token, or the fallback. */
const fillOf = (
  token: Fill | undefined,
  fallback: Style['fillStyle']
): Style['fillStyle'] => resolveFill(token ?? '') ?? fallback;

/** A corner resolved from a source token, or the fallback. */
const cornerOf = (
  token: SourceCorner | undefined,
  fallback: Style['corner']
): Style['corner'] => resolveCorner(token ?? '') ?? fallback;

/** The style a source node wears: its own tokens over the frame's style. */
export const nodeStyle = (
  base: Style,
  node: Pick<Node, 'color' | 'corner' | 'fill'>
): Style => ({
  ...base,
  corner: cornerOf(node.corner, base.corner),
  fill: colourOf(node.color, base.fill),
  fillStyle: fillOf(node.fill, base.fillStyle),
});

/** The style a source group wears: its colour token over the frame's style. */
export const groupStyle = (
  base: Style,
  group: Pick<Group, 'color'>
): Style => ({
  ...base,
  fill: colourOf(group.color, base.fill),
});

/** The style a source edge wears: its colour and dash over the frame's style. */
export const edgeStyle = (
  base: Style,
  edge: Pick<Edge, 'color' | 'dashed'>
): Style => ({
  ...base,
  dash: edge.dashed === true ? 'dashed' : base.dash,
  stroke:
    edge.color === undefined
      ? base.stroke
      : (resolveColor(edge.color) ?? base.stroke),
});

/** The two heads a source edge wears, one per end. */
export const edgeHeads = (
  edge: Pick<Edge, 'back' | 'bidirectional' | 'head'>
): { end: Head; start: Head } => {
  const named = edge.head === undefined ? null : resolveHead(edge.head);
  if (named !== null) {
    return edge.back === true
      ? { end: 'none', start: named }
      : { end: named, start: 'none' };
  }
  if (edge.bidirectional === true) {
    return { end: 'arrow', start: 'arrow' };
  }

  return edge.back === true
    ? { end: 'none', start: 'arrow' }
    : { end: 'arrow', start: 'none' };
};

/** The grammar's arrows carry no route, so a mapped connector draws straight. */
export const SOURCE_ROUTE: Route = 'straight';
