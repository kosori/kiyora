import type { FigureKind } from '../board/schema';
import { rectanglePath } from './figures';
import {
  curveTo,
  ellipse,
  type FigureGeometry,
  lineTo,
  moveTo,
  polygon,
  roundedRect,
  solid,
  strokeOnly,
} from './shape-path';

/** The star's ten alternating points: five tips, five valleys. */
const starPoints = (): [number, number][] =>
  Array.from({ length: 10 }, (_unused, index) => {
    const angle = ((-90 + index * 36) * Math.PI) / 180;
    const reach = index % 2 === 0 ? 0.5 : 0.19;
    return [0.5 + Math.cos(angle) * reach, 0.5 + Math.sin(angle) * reach];
  });

/** The figures whose geometry is a plain box, a polygon or a simple curve. */
export const BASIC_GEOMETRY = {
  'arrow-down': (shape) => [
    solid(
      polygon(shape, [
        [0.35, 0],
        [0.35, 0.58],
        [0.12, 0.58],
        [0.5, 1],
        [0.88, 0.58],
        [0.65, 0.58],
        [0.65, 0],
      ])
    ),
  ],

  'arrow-left': (shape) => [
    solid(
      polygon(shape, [
        [1, 0.35],
        [0.42, 0.35],
        [0.42, 0.12],
        [0, 0.5],
        [0.42, 0.88],
        [0.42, 0.65],
        [1, 0.65],
      ])
    ),
  ],

  'arrow-right': (shape) => [
    solid(
      polygon(shape, [
        [0, 0.35],
        [0.58, 0.35],
        [0.58, 0.12],
        [1, 0.5],
        [0.58, 0.88],
        [0.58, 0.65],
        [0, 0.65],
      ])
    ),
  ],

  'arrow-up': (shape) => [
    solid(
      polygon(shape, [
        [0.35, 1],
        [0.35, 0.42],
        [0.12, 0.42],
        [0.5, 0],
        [0.88, 0.42],
        [0.65, 0.42],
        [0.65, 1],
      ])
    ),
  ],

  bolt: (shape) => [
    solid(
      polygon(shape, [
        [0.56, 0],
        [0.22, 0.55],
        [0.46, 0.55],
        [0.36, 1],
        [0.76, 0.42],
        [0.52, 0.42],
      ])
    ),
  ],

  brace: (shape) => [
    strokeOnly(
      [
        moveTo(shape, [0.5, 0]),
        curveTo(shape, [0.3, 0], [0.3, 0.18], [0.3, 0.28]),
        lineTo(shape, [0.3, 0.4]),
        curveTo(shape, [0.3, 0.47], [0.24, 0.5], [0.16, 0.5]),
        curveTo(shape, [0.24, 0.5], [0.3, 0.53], [0.3, 0.6]),
        lineTo(shape, [0.3, 0.72]),
        curveTo(shape, [0.3, 0.82], [0.3, 1], [0.5, 1]),
      ].join(' ')
    ),
  ],

  callout: (shape) => [
    solid(
      polygon(shape, [
        [0, 0],
        [1, 0],
        [1, 0.75],
        [0.35, 0.75],
        [0.15, 1],
        [0.2, 0.75],
        [0, 0.75],
      ])
    ),
  ],

  checkbox: (shape) => [
    solid(roundedRect(shape, Math.min(shape.w, shape.h) * 0.16)),
    strokeOnly(
      [
        moveTo(shape, [0.24, 0.5]),
        lineTo(shape, [0.44, 0.72]),
        lineTo(shape, [0.78, 0.28]),
      ].join(' ')
    ),
  ],

  chevron: (shape) => [
    solid(
      polygon(shape, [
        [0, 0],
        [0.7, 0],
        [1, 0.5],
        [0.7, 1],
        [0, 1],
        [0.3, 0.5],
      ])
    ),
  ],

  circle: (shape) => {
    const diameter = Math.min(shape.w, shape.h);
    return [
      solid(
        ellipse(shape, 0.5, 0.5, diameter / 2 / shape.w, diameter / 2 / shape.h)
      ),
    ];
  },

  cloud: (shape) => [
    solid(
      `${[
        moveTo(shape, [0.25, 1]),
        curveTo(shape, [0.1, 1], [0, 0.9], [0, 0.75]),
        curveTo(shape, [0, 0.62], [0.08, 0.52], [0.2, 0.5]),
        curveTo(shape, [0.2, 0.28], [0.36, 0.12], [0.55, 0.12]),
        curveTo(shape, [0.72, 0.12], [0.86, 0.24], [0.89, 0.4]),
        curveTo(shape, [0.96, 0.44], [1, 0.54], [1, 0.66]),
        curveTo(shape, [1, 0.86], [0.86, 1], [0.7, 1]),
      ].join(' ')} Z`
    ),
  ],

  crossbox: (shape) => [
    solid(roundedRect(shape, Math.min(shape.w, shape.h) * 0.16)),
    strokeOnly(
      [
        moveTo(shape, [0.28, 0.28]),
        lineTo(shape, [0.72, 0.72]),
        moveTo(shape, [0.72, 0.28]),
        lineTo(shape, [0.28, 0.72]),
      ].join(' ')
    ),
  ],

  diamond: (shape) => [
    solid(
      polygon(shape, [
        [0.5, 0],
        [1, 0.5],
        [0.5, 1],
        [0, 0.5],
      ])
    ),
  ],

  ellipse: (shape) => [solid(ellipse(shape))],

  heart: (shape) => [
    solid(
      `${[
        moveTo(shape, [0.5, 1]),
        curveTo(shape, [0.15, 0.72], [0, 0.5], [0, 0.32]),
        curveTo(shape, [0, 0.12], [0.18, 0], [0.35, 0]),
        curveTo(shape, [0.43, 0], [0.49, 0.04], [0.5, 0.1]),
        curveTo(shape, [0.51, 0.04], [0.57, 0], [0.65, 0]),
        curveTo(shape, [0.82, 0], [1, 0.12], [1, 0.32]),
        curveTo(shape, [1, 0.5], [0.85, 0.72], [0.5, 1]),
      ].join(' ')} Z`
    ),
  ],

  hexagon: (shape) => [
    solid(
      polygon(shape, [
        [0.25, 0],
        [0.75, 0],
        [1, 0.5],
        [0.75, 1],
        [0.25, 1],
        [0, 0.5],
      ])
    ),
  ],

  note: (shape) => [
    solid(
      `${polygon(shape, [
        [0, 0],
        [0.72, 0],
        [1, 0.28],
        [1, 1],
        [0, 1],
      ])} ${moveTo(shape, [0.72, 0])} ${lineTo(shape, [0.72, 0.28])} ${lineTo(shape, [1, 0.28])}`
    ),
  ],

  octagon: (shape) => [
    solid(
      polygon(shape, [
        [0.3, 0],
        [0.7, 0],
        [1, 0.3],
        [1, 0.7],
        [0.7, 1],
        [0.3, 1],
        [0, 0.7],
        [0, 0.3],
      ])
    ),
  ],

  parallelogram: (shape) => [
    solid(
      polygon(shape, [
        [0.25, 0],
        [1, 0],
        [0.75, 1],
        [0, 1],
      ])
    ),
  ],

  pentagon: (shape) => [
    solid(
      polygon(shape, [
        [0.5, 0],
        [1, 0.38],
        [0.82, 1],
        [0.18, 1],
        [0, 0.38],
      ])
    ),
  ],

  plus: (shape) => [
    solid(
      polygon(shape, [
        [0.35, 0],
        [0.65, 0],
        [0.65, 0.35],
        [1, 0.35],
        [1, 0.65],
        [0.65, 0.65],
        [0.65, 1],
        [0.35, 1],
        [0.35, 0.65],
        [0, 0.65],
        [0, 0.35],
        [0.35, 0.35],
      ])
    ),
  ],
  rectangle: (shape) => [
    solid(
      shape.style.corner === 'rounded'
        ? roundedRect(shape, Math.min(shape.w, shape.h) * 0.16)
        : rectanglePath(shape)
    ),
  ],

  'speech-bubble': (shape) => [
    solid(
      `${[
        moveTo(shape, [0.12, 0]),
        lineTo(shape, [0.88, 0]),
        curveTo(shape, [0.95, 0], [1, 0.06], [1, 0.14]),
        lineTo(shape, [1, 0.62]),
        curveTo(shape, [1, 0.7], [0.95, 0.76], [0.88, 0.76]),
        lineTo(shape, [0.42, 0.76]),
        lineTo(shape, [0.24, 0.98]),
        lineTo(shape, [0.3, 0.76]),
        lineTo(shape, [0.12, 0.76]),
        curveTo(shape, [0.05, 0.76], [0, 0.7], [0, 0.62]),
        lineTo(shape, [0, 0.14]),
        curveTo(shape, [0, 0.06], [0.05, 0], [0.12, 0]),
      ].join(' ')} Z`
    ),
  ],

  star: (shape) => [solid(polygon(shape, starPoints()))],

  trapezoid: (shape) => [
    solid(
      polygon(shape, [
        [0.2, 0],
        [0.8, 0],
        [1, 1],
        [0, 1],
      ])
    ),
  ],

  triangle: (shape) => [
    solid(
      polygon(shape, [
        [0.5, 0],
        [1, 1],
        [0, 1],
      ])
    ),
  ],
} satisfies Partial<Record<FigureKind, FigureGeometry>>;
