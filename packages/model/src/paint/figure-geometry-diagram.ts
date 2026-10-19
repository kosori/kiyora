import type { FigureKind } from '../board/schema';
import {
  curveTo,
  ellipse,
  type FigureGeometry,
  lineTo,
  moveTo,
  polygon,
  solid,
  strokeOnly,
} from './shape-path';

/** The figures the diagram families contribute: BPMN, UML and the rest. */
export const DIAGRAM_GEOMETRY = {
  actor: (shape) => {
    const head = Math.min(shape.w, shape.h) * 0.12;

    return [
      strokeOnly(ellipse(shape, 0.5, 0.14, head / shape.w, head / shape.h)),
      strokeOnly(`${moveTo(shape, [0.5, 0.28])} ${lineTo(shape, [0.5, 0.62])}`),
      strokeOnly(
        `${moveTo(shape, [0.28, 0.42])} ${lineTo(shape, [0.72, 0.42])}`
      ),
      strokeOnly(`${moveTo(shape, [0.5, 0.62])} ${lineTo(shape, [0.3, 1])}`),
      strokeOnly(`${moveTo(shape, [0.5, 0.62])} ${lineTo(shape, [0.7, 1])}`),
    ];
  },

  card: (shape) => [
    solid(
      polygon(shape, [
        [0, 0],
        [0.78, 0],
        [1, 0.22],
        [1, 1],
        [0, 1],
      ])
    ),
  ],

  component: (shape) => [
    solid(
      polygon(shape, [
        [0.12, 0],
        [1, 0],
        [1, 1],
        [0.12, 1],
      ])
    ),
    solid(
      polygon(shape, [
        [0, 0.2],
        [0.12, 0.2],
        [0.12, 0.36],
        [0, 0.36],
      ])
    ),
    solid(
      polygon(shape, [
        [0, 0.6],
        [0.12, 0.6],
        [0.12, 0.76],
        [0, 0.76],
      ])
    ),
  ],

  cube: (shape) => [
    solid(
      polygon(shape, [
        [0, 0.28],
        [0.72, 0.28],
        [0.72, 1],
        [0, 1],
      ])
    ),
    solid(
      polygon(shape, [
        [0, 0.28],
        [0.28, 0],
        [1, 0],
        [0.72, 0.28],
      ])
    ),
    solid(
      polygon(shape, [
        [0.72, 0.28],
        [1, 0],
        [1, 0.72],
        [0.72, 1],
      ])
    ),
  ],
  cylinder: (shape) => [
    solid(
      `${[
        moveTo(shape, [0, 0.16]),
        curveTo(shape, [0, 0.07], [0.22, 0], [0.5, 0]),
        curveTo(shape, [0.78, 0], [1, 0.07], [1, 0.16]),
        lineTo(shape, [1, 0.84]),
        curveTo(shape, [1, 0.93], [0.78, 1], [0.5, 1]),
        curveTo(shape, [0.22, 1], [0, 0.93], [0, 0.84]),
      ].join(' ')} Z`
    ),
    solid(
      [
        moveTo(shape, [0, 0.16]),
        curveTo(shape, [0, 0.25], [0.22, 0.32], [0.5, 0.32]),
        curveTo(shape, [0.78, 0.32], [1, 0.25], [1, 0.16]),
      ].join(' ')
    ),
  ],

  delay: (shape) => [
    solid(
      `${[
        moveTo(shape, [0, 0]),
        lineTo(shape, [0.5, 0]),
        curveTo(shape, [0.78, 0], [1, 0.22], [1, 0.5]),
        curveTo(shape, [1, 0.78], [0.78, 1], [0.5, 1]),
        lineTo(shape, [0, 1]),
      ].join(' ')} Z`
    ),
  ],

  document: (shape) => [
    solid(
      `${[
        moveTo(shape, [0, 0]),
        lineTo(shape, [1, 0]),
        lineTo(shape, [1, 0.82]),
        curveTo(shape, [0.75, 0.7], [0.25, 0.94], [0, 0.82]),
      ].join(' ')} Z`
    ),
  ],

  'double-circle': (shape) => [
    solid(ellipse(shape)),
    strokeOnly(ellipse(shape, 0.5, 0.5, 0.36, 0.36)),
  ],

  entity: (shape) => [
    solid(
      polygon(shape, [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ])
    ),
    strokeOnly(`${moveTo(shape, [0, 0.28])} ${lineTo(shape, [1, 0.28])}`),
    strokeOnly(`${moveTo(shape, [0, 0.72])} ${lineTo(shape, [1, 0.72])}`),
  ],

  'fork-join': (shape) => [
    solid(
      polygon(shape, [
        [0.4, 0],
        [0.6, 0],
        [0.6, 1],
        [0.4, 1],
      ])
    ),
  ],

  'manual-input': (shape) => [
    solid(
      polygon(shape, [
        [0, 0.22],
        [1, 0],
        [1, 1],
        [0, 1],
      ])
    ),
  ],

  'multi-document': (shape) => [
    solid(
      `${[
        moveTo(shape, [0, 0.16]),
        lineTo(shape, [0.88, 0.16]),
        lineTo(shape, [0.88, 0.9]),
        curveTo(shape, [0.66, 0.8], [0.22, 1], [0, 0.9]),
      ].join(' ')} Z`
    ),
    strokeOnly(
      [
        moveTo(shape, [0.06, 0.08]),
        lineTo(shape, [0.94, 0.08]),
        lineTo(shape, [0.94, 0.16]),
      ].join(' ')
    ),
    strokeOnly(
      [
        moveTo(shape, [0.12, 0]),
        lineTo(shape, [1, 0]),
        lineTo(shape, [1, 0.08]),
      ].join(' ')
    ),
  ],

  'multi-process': (shape) => [
    solid(
      polygon(shape, [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ])
    ),
    strokeOnly(`${moveTo(shape, [0.2, 0])} ${lineTo(shape, [0.2, 1])}`),
    strokeOnly(`${moveTo(shape, [0.8, 0])} ${lineTo(shape, [0.8, 1])}`),
    strokeOnly(`${moveTo(shape, [0, 0.2])} ${lineTo(shape, [1, 0.2])}`),
    strokeOnly(`${moveTo(shape, [0, 0.8])} ${lineTo(shape, [1, 0.8])}`),
  ],

  package: (shape) => [
    solid(
      polygon(shape, [
        [0, 0.15],
        [0.38, 0.15],
        [0.38, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ])
    ),
  ],

  'predefined-process': (shape) => [
    solid(
      polygon(shape, [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ])
    ),
    strokeOnly(`${moveTo(shape, [0.12, 0])} ${lineTo(shape, [0.12, 1])}`),
    strokeOnly(`${moveTo(shape, [0.88, 0])} ${lineTo(shape, [0.88, 1])}`),
  ],

  queue: (shape) => [
    solid(
      `${[
        moveTo(shape, [0.5, 0]),
        lineTo(shape, [1, 0]),
        lineTo(shape, [1, 1]),
        lineTo(shape, [0.5, 1]),
        curveTo(shape, [0.22, 1], [0, 0.78], [0, 0.5]),
        curveTo(shape, [0, 0.22], [0.22, 0], [0.5, 0]),
      ].join(' ')} Z`
    ),
  ],
} satisfies Partial<Record<FigureKind, FigureGeometry>>;
