/**
 * The families `model` names but does not load. A shape and a diagram label are
 * set in the hand-drawn face; an inline code run is set in the monospace face,
 * so code reads as code. Both the measurer and the two renderers read these, so
 * the width a label wraps at and the width it draws at cannot disagree.
 */

/** The hand-drawn face shape and diagram text is set in. */
export const TEXT_FONT_FAMILY =
  "'Balsamiq Sans Neue', 'Balsamiq Sans', sans-serif";

/** The monospace face an inline code run is set in, vendored by the app. */
export const CODE_FONT_FAMILY = "'Geist Mono', ui-monospace, monospace";

/** The family a run draws in: monospace for code, the hand-drawn face otherwise. */
export const fontFamilyOf = (run: { code: boolean }): string =>
  run.code ? CODE_FONT_FAMILY : TEXT_FONT_FAMILY;
