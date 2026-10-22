import type { InkShape, Shape } from '../board/schema';
import { formatNumber } from '../format';
import { INK_HIGHLIGHTER_ALPHA, inkPath } from '../ink/ink';
import type { Paint, PaintContext } from './paint';
import { paintColour } from './palette';

/**
 * One ink stroke: a single filled path, in the stroke colour, with the rotation
 * turned into a transform so the stroke follows its box without recomputing
 * every point. A highlighter paints its colour at a fixed translucency, so it
 * reads as a marker rather than a thick pen.
 */
export const paintInk = (shape: InkShape, context: PaintContext): Paint => {
  const cx = shape.x + shape.w / 2;
  const cy = shape.y + shape.h / 2;
  const alpha =
    (shape.mode === 'highlighter' ? INK_HIGHLIGHTER_ALPHA : 1) * shape.opacity;

  return {
    children: [],
    paths: [
      {
        d: inkPath(shape),
        fill: paintColour(shape.style.stroke, context.theme, alpha),
        stroke: 'none',
        ...(shape.rotation === 0
          ? {}
          : {
              transform: `rotate(${formatNumber(shape.rotation)} ${formatNumber(cx)} ${formatNumber(cy)})`,
            }),
      },
    ],
  };
};

/** Whether `shape` is a highlighter, the mode that paints behind its siblings. */
const isUnderlay = (shape: Shape): boolean =>
  shape.kind === 'ink' && shape.mode === 'highlighter';

/**
 * The highlighter nodes moved to the front of each sibling list, relative order
 * kept, so the band a highlighter lays sits behind the words it crosses. It is
 * the one place paint order bends for a mode, and it bends the same way on the
 * canvas and in an export.
 */
export const highlightersFirst = (
  paint: Paint,
  shapes: readonly Shape[]
): Paint => {
  const under = new Set(
    shapes.filter((shape) => isUnderlay(shape)).map((shape) => shape.id)
  );
  const walk = (node: Paint): Paint => {
    const children = node.children.map(walk);
    const behind = children.filter(
      (child) => child.shapeId !== undefined && under.has(child.shapeId)
    );

    return {
      ...node,
      children: [
        ...behind,
        ...children.filter((child) => !behind.includes(child)),
      ],
    };
  };

  return walk(paint);
};
