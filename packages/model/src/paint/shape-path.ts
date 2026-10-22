import type { FigureShape, Shape } from '../board/schema';
import { formatNumber } from '../format';
import { centreOf, type Point, turn } from './figures';

/**
 * The authored box every path is mapped onto. A figure draws on its own box; a
 * device frame draws its chrome on the box its author gave it, so both share
 * one mapping and rotation turns with either.
 */
export type BoxShape = Pick<Shape, 'h' | 'rotation' | 'w' | 'x' | 'y'>;

/**
 * A point on a shape's box as a fraction of it: `u` across, `v` down, each from
 * 0 to 1. A figure is authored in these fractions and mapped onto the box, so
 * one geometry serves every size and the shape's rotation turns with it.
 */
export type UnitPoint = readonly [u: number, v: number];

/** One path a figure draws, and whether the fill style reaches it. */
export type Ink = {
  d: string;
  filled?: boolean;
};

/**
 * A figure's geometry: the paths it draws, in board coordinates. A figure that
 * needs a fold, a rim or a glyph returns more than one entry, each free to opt
 * out of the fill so a stroked detail is not painted as a solid.
 */
export type FigureGeometry = (shape: FigureShape) => readonly Ink[];

/** An open path: the stroke carries it and the fill style never reaches it. */
export const strokeOnly = (d: string): Ink => ({ d, filled: false });

/** A closed path the fill style reaches. */
export const solid = (d: string): Ink => ({ d });

/** The ratio a quarter circle's control point sits at, for a Bezier arc. */
export const KAPPA = 0.552_284_749_830_793_6;

/** The board point a unit point names, turned about the shape's centre. */
export const at = (shape: BoxShape, [u, v]: UnitPoint): Point =>
  turn(
    { x: shape.x + u * shape.w, y: shape.y + v * shape.h },
    centreOf(shape),
    shape.rotation
  );

const xy = (shape: BoxShape, point: UnitPoint): string => {
  const { x, y } = at(shape, point);
  return `${formatNumber(x)} ${formatNumber(y)}`;
};

/** A move to `point`. */
export const moveTo = (shape: BoxShape, point: UnitPoint): string =>
  `M ${xy(shape, point)}`;

/** A line to `point`. */
export const lineTo = (shape: BoxShape, point: UnitPoint): string =>
  `L ${xy(shape, point)}`;

/** A cubic curve to `to`, bowed by `first` and `second`. */
export const curveTo = (
  shape: BoxShape,
  first: UnitPoint,
  second: UnitPoint,
  to: UnitPoint
): string => `C ${xy(shape, first)} ${xy(shape, second)} ${xy(shape, to)}`;

/** A closed straight-sided path through `nodes`. */
export const polygon = (shape: BoxShape, nodes: readonly UnitPoint[]): string =>
  `${nodes
    .map((node, index) => `${moveOrLine(index)} ${xy(shape, node)}`)
    .join(' ')} Z`;

/** An open straight-sided path through `nodes`. */
export const polyline = (
  shape: BoxShape,
  nodes: readonly UnitPoint[]
): string =>
  nodes
    .map((node, index) => `${moveOrLine(index)} ${xy(shape, node)}`)
    .join(' ');

const moveOrLine = (index: number): string => (index === 0 ? 'M' : 'L');

/** A closed ellipse: four Bezier quarters, so rotation turns with the box. */
export const ellipse = (
  shape: BoxShape,
  cx = 0.5,
  cy = 0.5,
  rx = 0.5,
  ry = 0.5
): string => {
  const kx = rx * KAPPA;
  const ky = ry * KAPPA;

  return [
    moveTo(shape, [cx + rx, cy]),
    curveTo(shape, [cx + rx, cy - ky], [cx + kx, cy - ry], [cx, cy - ry]),
    curveTo(shape, [cx - kx, cy - ry], [cx - rx, cy - ky], [cx - rx, cy]),
    curveTo(shape, [cx - rx, cy + ky], [cx - kx, cy + ry], [cx, cy + ry]),
    curveTo(shape, [cx + kx, cy + ry], [cx + rx, cy + ky], [cx + rx, cy]),
  ].join(' ');
};

/**
 * A closed rectangle with equal board-unit corners. The radius is read in board
 * units, so a box of any ratio keeps round corners rather than stretched ones.
 */
export const roundedRect = (shape: BoxShape, radius: number): string => {
  const ru = Math.min(radius / shape.w, 0.5);
  const rv = Math.min(radius / shape.h, 0.5);
  const kx = ru * KAPPA;
  const ky = rv * KAPPA;

  return [
    moveTo(shape, [ru, 0]),
    lineTo(shape, [1 - ru, 0]),
    curveTo(shape, [1 - ru + kx, 0], [1, rv - ky], [1, rv]),
    lineTo(shape, [1, 1 - rv]),
    curveTo(shape, [1, 1 - rv + ky], [1 - ru + kx, 1], [1 - ru, 1]),
    lineTo(shape, [ru, 1]),
    curveTo(shape, [ru - kx, 1], [0, 1 - rv + ky], [0, 1 - rv]),
    lineTo(shape, [0, rv]),
    curveTo(shape, [0, rv - ky], [ru - kx, 0], [ru, 0]),
  ].join(' ');
};
