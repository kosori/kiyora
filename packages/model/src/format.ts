/**
 * Renders a number as the shortest text that keeps paint byte-identical: the
 * noise trigonometry leaves behind is rounded away.
 */
export const formatNumber = (value: number): string => {
  const rounded = Number(value.toFixed(3));
  return Object.is(rounded, -0) ? '0' : String(rounded);
};
