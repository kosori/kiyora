import { z } from 'zod';

/** The nine colours a board may use. Any other colour snaps to the nearest one. */
export const PALETTE_COLOURS = [
  'ink',
  'red',
  'orange',
  'yellow',
  'green',
  'teal',
  'blue',
  'violet',
  'pink',
] as const;

/** A named colour in the palette. */
export const paletteColourSchema = z.enum(PALETTE_COLOURS);

/** A named colour in the palette. */
export type PaletteColour = z.infer<typeof paletteColourSchema>;

/** The three fill styles. */
export const FILL_STYLES = ['none', 'solid', 'tint'] as const;

/** How a shape's interior is filled. */
export const fillStyleSchema = z.enum(FILL_STYLES);

/** How a shape's interior is filled. */
export type FillStyle = z.infer<typeof fillStyleSchema>;

/** The two canvases a board is painted on. */
export const themeSchema = z.enum(['light', 'dark']);

/** The canvas a board is painted on. */
export type Theme = z.infer<typeof themeSchema>;

/** One palette colour, as it reads on each theme's canvas. */
export type PaletteEntry = {
  light: string;
  dark: string;
};

/** The nine colours, on a light canvas and on a dark one. */
export const PALETTE: Record<PaletteColour, PaletteEntry> = {
  blue: { dark: '#74c0fc', light: '#1971c2' },
  green: { dark: '#8ce99a', light: '#2f9e44' },
  ink: { dark: '#e9ecef', light: '#1e1e1e' },
  orange: { dark: '#ffc078', light: '#f08c00' },
  pink: { dark: '#faa2c1', light: '#c2255c' },
  red: { dark: '#ff8787', light: '#e03131' },
  teal: { dark: '#66d9e8', light: '#0c8599' },
  violet: { dark: '#b197fc', light: '#6741d9' },
  yellow: { dark: '#ffe066', light: '#f2c037' },
};

/** The alpha each fill style paints at, before the shape's own opacity. */
export const FILL_ALPHA: Record<FillStyle, number> = {
  none: 0,
  solid: 1,
  tint: 0.2,
};

const toRgb = (value: string): [number, number, number] => [
  Number.parseInt(value.slice(1, 3), 16),
  Number.parseInt(value.slice(3, 5), 16),
  Number.parseInt(value.slice(5, 7), 16),
];

/**
 * A palette colour as a CSS colour on one theme's canvas, translucent when the
 * alpha falls short of opaque.
 */
export const paintColour = (
  colour: PaletteColour,
  theme: Theme,
  alpha = 1
): string => {
  const value = PALETTE[colour][theme];
  if (alpha >= 1) {
    return value;
  }
  const [red, green, blue] = toRgb(value);
  return `rgba(${red}, ${green}, ${blue}, ${Number(alpha.toFixed(3))})`;
};
