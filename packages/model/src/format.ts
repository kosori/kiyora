/**
 * Renders a number as the shortest text that keeps paint byte-identical: the
 * noise trigonometry leaves behind is rounded away.
 */
export const formatNumber = (value: number): string => {
  const rounded = Number(value.toFixed(3));
  return Object.is(rounded, -0) ? '0' : String(rounded);
};

/** The bytes UTF-8 would write, counted without a `TextEncoder`, so `model` stays pure. */
export const utf8Length = (value: string): number => {
  let bytes = 0;

  for (const character of value) {
    const point = character.codePointAt(0) ?? 0;
    if (point < 0x80) {
      bytes += 1;
    } else if (point < 0x8_00) {
      bytes += 2;
    } else if (point < 0x1_00_00) {
      bytes += 3;
    } else {
      bytes += 4;
    }
  }

  return bytes;
};
