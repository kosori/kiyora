import type { FrameShape, FrameVariant } from '../board/schema';
import { ellipse, polygon, polyline, roundedRect } from './shape-path';

/**
 * What a chrome path is for. The body wears the frame's own style, so a device
 * frame is still the shape its author styled; every other part is chrome ink,
 * resolved from the foreground token so it reads on both themes.
 */
export type FrameChromeRole = 'body' | 'bar' | 'dot' | 'line';

/** One path a device frame's chrome draws, in board coordinates. */
export type FrameChromePath = {
  d: string;
  role: FrameChromeRole;
};

/** The chrome one variant draws inside the frame's authored box. */
export type FrameChrome = (shape: FrameShape) => readonly FrameChromePath[];

const body = (d: string): FrameChromePath => ({ d, role: 'body' });

const bar = (d: string): FrameChromePath => ({ d, role: 'bar' });

const dot = (d: string): FrameChromePath => ({ d, role: 'dot' });

const line = (d: string): FrameChromePath => ({ d, role: 'line' });

/** The height of a title bar, in board units, for a frame `h` tall. */
const barHeight = (shape: FrameShape): number => Math.min(40, shape.h * 0.14);

/** A rectangle inset from the authored box by `inset` board units. */
const insetRect = (shape: FrameShape, inset: number): string => {
  const x = Math.min(inset, shape.w / 2) / shape.w;
  const y = Math.min(inset, shape.h / 2) / shape.h;
  return polygon(shape, [
    [x, y],
    [1 - x, y],
    [1 - x, 1 - y],
    [x, 1 - y],
  ]);
};

/** The rectangle a title bar fills: the full width, down to `bottom`. */
const titleBar = (shape: FrameShape, bottom: number): string =>
  polygon(shape, [
    [0, 0],
    [1, 0],
    [1, bottom],
    [0, bottom],
  ]);

/** The three dots a browser puts on its bar, and the window control on a window's. */
const browser: FrameChrome = (shape) => {
  const height = barHeight(shape);
  const radius = Math.min(5, height * 0.18);
  const gap = radius * 2.6;
  const centreY = height / 2 / shape.h;
  const circles = [0, 1, 2].map((index) =>
    dot(
      ellipse(
        shape,
        (radius * 2 + gap * index) / shape.w,
        centreY,
        radius / shape.w,
        radius / shape.h
      )
    )
  );

  return [
    body(
      polygon(shape, [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ])
    ),
    bar(titleBar(shape, height / shape.h)),
    ...circles,
  ];
};

const window: FrameChrome = (shape) => {
  const height = barHeight(shape);
  const control = Math.min(9, height * 0.3);
  const centreX = 1 - (control * 1.8) / shape.w;
  const centreY = height / 2 / shape.h;
  const radiusX = control / 2 / shape.w;
  const radiusY = control / 2 / shape.h;

  return [
    body(
      polygon(shape, [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ])
    ),
    bar(titleBar(shape, height / shape.h)),
    line(
      polyline(shape, [
        [centreX - radiusX, centreY - radiusY],
        [centreX + radiusX, centreY + radiusY],
      ])
    ),
    line(
      polyline(shape, [
        [centreX + radiusX, centreY - radiusY],
        [centreX - radiusX, centreY + radiusY],
      ])
    ),
  ];
};

const phone: FrameChrome = (shape) => {
  const smallest = Math.min(shape.w, shape.h);
  const bezel = Math.min(24, smallest * 0.05);
  const notchWidth = Math.min(shape.w * 0.3, 110);
  const notchHeight = Math.min(16, shape.h * 0.03);
  const indicatorY = 1 - (bezel * 0.5) / shape.h;

  return [
    body(roundedRect(shape, Math.min(48, smallest * 0.12))),
    line(insetRect(shape, bezel)),
    bar(
      ellipse(
        shape,
        0.5,
        bezel / shape.h,
        notchWidth / 2 / shape.w,
        notchHeight / 2 / shape.h
      )
    ),
    line(
      polyline(shape, [
        [0.36, indicatorY],
        [0.64, indicatorY],
      ])
    ),
  ];
};

const tablet: FrameChrome = (shape) => {
  const smallest = Math.min(shape.w, shape.h);
  const bezel = Math.min(20, smallest * 0.045);
  const camera = Math.min(4, smallest * 0.01);

  return [
    body(roundedRect(shape, Math.min(36, smallest * 0.08))),
    line(insetRect(shape, bezel)),
    dot(
      ellipse(
        shape,
        0.5,
        (bezel * 0.5) / shape.h,
        camera / shape.w,
        camera / shape.h
      )
    ),
  ];
};

/**
 * The chrome each variant draws inside its authored box. `plain` draws none, so
 * its paint stays the one clean box every existing board and golden has. The
 * chrome is drawn before a frame's members, and the clip stays the authored box,
 * so a member at the frame's top-left is visible over the chrome rather than
 * hidden under it or clipped away.
 */
export const FRAME_CHROME = {
  browser,
  phone,
  plain: () => [],
  tablet,
  window,
} satisfies Record<FrameVariant, FrameChrome>;
