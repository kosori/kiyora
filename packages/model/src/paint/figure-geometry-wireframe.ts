import type { FigureKind, FigureShape } from '../board/schema';
import { rectanglePath } from './figures';
import {
  curveTo,
  ellipse,
  type FigureGeometry,
  lineTo,
  moveTo,
  polygon,
  polyline,
  roundedRect,
  solid,
  strokeOnly,
} from './shape-path';

/** A box inside the authored box: left, top, right and bottom as fractions. */
type UnitBox = readonly [
  left: number,
  top: number,
  right: number,
  bottom: number,
];

/** A box inside the authored box, with a sharp outline. */
const innerBox = (
  shape: FigureShape,
  [left, top, right, bottom]: UnitBox
): string =>
  polygon(shape, [
    [left, top],
    [right, top],
    [right, bottom],
    [left, bottom],
  ]);

/** A straight detail inside the authored box. */
const rule = (
  shape: FigureShape,
  from: readonly [number, number],
  to: readonly [number, number]
) => strokeOnly(`${moveTo(shape, from)} ${lineTo(shape, to)}`);

/** A radius in board units, as a fraction of the shorter side. */
const radiusOf = (shape: FigureShape, fraction: number): number =>
  Math.min(shape.w, shape.h) * fraction;

/** A circle on the shape's box, with its radius in board units. */
const circle = (
  shape: FigureShape,
  cx: number,
  cy: number,
  radius: number
): string => ellipse(shape, cx, cy, radius / shape.w, radius / shape.h);

/**
 * The control's outer box. The corner is the shape's own style token, so a
 * control reads as the board's vocabulary rather than as a screenshot: square
 * by default, rounded when the author asks for it.
 */
const outline = (shape: FigureShape, fraction: number): string =>
  shape.style.corner === 'rounded'
    ? roundedRect(shape, radiusOf(shape, fraction))
    : rectanglePath(shape);

/**
 * The wireframe controls: figure kinds that draw a UI control from the box
 * they were authored in. Every path is a little ink on that box — never a
 * second document, image or borrowed measurement — so the palette, the stroke
 * width, the dash and the corner are the ones the board already uses.
 */
export const WIREFRAME_GEOMETRY = {
  avatar: (shape) => [
    solid(ellipse(shape)),
    strokeOnly(circle(shape, 0.5, 0.38, radiusOf(shape, 0.16))),
    strokeOnly(
      [
        moveTo(shape, [0.24, 0.82]),
        curveTo(shape, [0.26, 0.64], [0.38, 0.58], [0.5, 0.58]),
        curveTo(shape, [0.62, 0.58], [0.74, 0.64], [0.76, 0.82]),
      ].join(' ')
    ),
  ],

  badge: (shape) => [
    solid(roundedRect(shape, radiusOf(shape, 0.5))),
    rule(shape, [0.28, 0.5], [0.72, 0.5]),
  ],

  breadcrumb: (shape) => [
    rule(shape, [0.02, 0.5], [0.18, 0.5]),
    strokeOnly(
      polyline(shape, [
        [0.25, 0.38],
        [0.3, 0.5],
        [0.25, 0.62],
      ])
    ),
    rule(shape, [0.36, 0.5], [0.52, 0.5]),
    strokeOnly(
      polyline(shape, [
        [0.59, 0.38],
        [0.64, 0.5],
        [0.59, 0.62],
      ])
    ),
    rule(shape, [0.7, 0.5], [0.98, 0.5]),
  ],

  button: (shape) => [
    solid(outline(shape, 0.18)),
    rule(shape, [0.3, 0.5], [0.7, 0.5]),
  ],

  divider: (shape) => [solid(innerBox(shape, [0, 0.46, 1, 0.54]))],

  dropdown: (shape) => [
    solid(outline(shape, 0.12)),
    rule(shape, [0.08, 0.5], [0.55, 0.5]),
    strokeOnly(
      polyline(shape, [
        [0.78, 0.42],
        [0.86, 0.56],
        [0.94, 0.42],
      ])
    ),
  ],

  input: (shape) => [
    solid(outline(shape, 0.12)),
    rule(shape, [0.08, 0.32], [0.08, 0.68]),
    rule(shape, [0.14, 0.5], [0.6, 0.5]),
  ],

  pagination: (shape) => [
    strokeOnly(
      polyline(shape, [
        [0.04, 0.38],
        [0.1, 0.5],
        [0.04, 0.62],
      ])
    ),
    solid(innerBox(shape, [0.18, 0.28, 0.32, 0.72])),
    strokeOnly(innerBox(shape, [0.36, 0.28, 0.5, 0.72])),
    strokeOnly(innerBox(shape, [0.54, 0.28, 0.68, 0.72])),
    strokeOnly(
      polyline(shape, [
        [0.96, 0.38],
        [0.9, 0.5],
        [0.96, 0.62],
      ])
    ),
  ],

  radio: (shape) => [
    solid(ellipse(shape)),
    strokeOnly(circle(shape, 0.5, 0.5, radiusOf(shape, 0.18))),
  ],

  slider: (shape) => [
    solid(innerBox(shape, [0.05, 0.44, 0.95, 0.56])),
    strokeOnly(circle(shape, 0.62, 0.5, radiusOf(shape, 0.14))),
  ],

  table: (shape) => [
    solid(innerBox(shape, [0, 0, 1, 1])),
    rule(shape, [0, 0.28], [1, 0.28]),
    rule(shape, [0, 0.52], [1, 0.52]),
    rule(shape, [0, 0.76], [1, 0.76]),
    rule(shape, [0.38, 0], [0.38, 1]),
    rule(shape, [0.7, 0], [0.7, 1]),
  ],

  tabs: (shape) => [
    strokeOnly(innerBox(shape, [0, 0, 0.31, 0.8])),
    solid(innerBox(shape, [0.33, 0, 0.64, 0.8])),
    strokeOnly(innerBox(shape, [0.66, 0, 0.97, 0.8])),
    rule(shape, [0, 0.9], [1, 0.9]),
    rule(shape, [0.06, 0.44], [0.25, 0.44]),
    rule(shape, [0.39, 0.44], [0.58, 0.44]),
    rule(shape, [0.72, 0.44], [0.91, 0.44]),
  ],

  'text-area': (shape) => [
    solid(outline(shape, 0.12)),
    rule(shape, [0.08, 0.3], [0.9, 0.3]),
    rule(shape, [0.08, 0.5], [0.9, 0.5]),
    rule(shape, [0.08, 0.7], [0.55, 0.7]),
  ],

  toggle: (shape) => [
    solid(roundedRect(shape, radiusOf(shape, 0.5))),
    strokeOnly(circle(shape, 0.72, 0.5, radiusOf(shape, 0.18))),
  ],
} satisfies Partial<Record<FigureKind, FigureGeometry>>;
