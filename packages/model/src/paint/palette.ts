import { COLORS, FILLS } from '@kiyora/dsl';
import { z } from 'zod';

/**
 * The nine colours a board may use, taken from the grammar so the picker, the
 * inspector and the parser share one list. Any other colour snaps to one of
 * these; the palette owns only the value each colour takes per canvas.
 */
export const PALETTE_COLOURS = COLORS;

/** A named colour in the palette. */
export const paletteColourSchema = z.enum(PALETTE_COLOURS);

/** A named colour in the palette. */
export type PaletteColour = z.infer<typeof paletteColourSchema>;

/** The three fill styles, taken from the grammar. */
export const FILL_STYLES = FILLS;

/** How a shape's interior is filled. */
export const fillStyleSchema = z.enum(FILL_STYLES);

/** How a shape's interior is filled. */
export type FillStyle = z.infer<typeof fillStyleSchema>;

/** The two canvases a board is painted on. */
export const themeSchema = z.enum(['light', 'dark']);

/** The canvas a board is painted on. */
export type Theme = z.infer<typeof themeSchema>;

/** One colour, as it reads on each theme's canvas. */
export type PaletteEntry = {
  light: string;
  dark: string;
};

/**
 * The default stroke, and the one token a colour check must accept that the
 * grammar does not name: a near-black on a light canvas and a near-white on a
 * dark one. It reaches no hue, so it is a foreground outside the palette rather
 * than a tenth colour competing with the grammar's nine. The token stays `ink`
 * so boards authored before the split still validate.
 */
export const FOREGROUND = 'ink' as const;

/** The foreground token: a stroke colour outside the palette. */
export const foregroundSchema = z.literal(FOREGROUND);

/** The foreground token: a stroke colour outside the palette. */
export type Foreground = z.infer<typeof foregroundSchema>;

/** The nine palette colours, on a light canvas and on a dark one. */
export const PALETTE: Record<PaletteColour, PaletteEntry> = {
  blue: { dark: '#74c0fc', light: '#1971c2' },
  gray: { dark: '#ced4da', light: '#868e96' },
  green: { dark: '#8ce99a', light: '#2f9e44' },
  orange: { dark: '#ffc078', light: '#f08c00' },
  pink: { dark: '#faa2c1', light: '#c2255c' },
  red: { dark: '#ff8787', light: '#e03131' },
  teal: { dark: '#66d9e8', light: '#0c8599' },
  violet: { dark: '#b197fc', light: '#6741d9' },
  yellow: { dark: '#ffe066', light: '#f2c037' },
};

/** The foreground token, on a light canvas and on a dark one. */
export const FOREGROUND_ENTRY: PaletteEntry = {
  dark: '#e9ecef',
  light: '#1e1e1e',
};

/** The alpha each fill style paints at, before the shape's own opacity. */
export const FILL_ALPHA: Record<FillStyle, number> = {
  bold: 1,
  outline: 0,
  pastel: 0.2,
};

const toRgb = (value: string): [number, number, number] => [
  Number.parseInt(value.slice(1, 3), 16),
  Number.parseInt(value.slice(3, 5), 16),
  Number.parseInt(value.slice(5, 7), 16),
];

const swatchOf = (colour: PaletteColour | Foreground, theme: Theme): string =>
  colour === FOREGROUND ? FOREGROUND_ENTRY[theme] : PALETTE[colour][theme];

/**
 * A palette colour or the foreground token as a CSS colour on one theme's
 * canvas, translucent when the alpha falls short of opaque.
 */
export const paintColour = (
  colour: PaletteColour | Foreground,
  theme: Theme,
  alpha = 1
): string => {
  const value = swatchOf(colour, theme);
  if (alpha >= 1) {
    return value;
  }
  const [red, green, blue] = toRgb(value);
  return `rgba(${red}, ${green}, ${blue}, ${Number(alpha.toFixed(3))})`;
};
