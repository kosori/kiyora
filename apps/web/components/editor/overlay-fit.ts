/**
 * The class a menu or a list wears when it has more rows than room: a thin bar
 * in the border colour, with its gutter always reserved, so a surface that
 * scrolls says so instead of cutting its last rows off in silence.
 */
export const SCROLLABLE =
  'overflow-y-auto [scrollbar-color:var(--border)_transparent] [scrollbar-gutter:stable] [scrollbar-width:thin]';
