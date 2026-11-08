const KAPPA = 0.552_284_749_830_793_6;

const number = (value: number): string => String(Number(value.toFixed(3)));

/**
 * The path a rectangle with rounded corners paints, matching the model's own
 * formatting. Specs that draw a shape read it by the bytes the board stores.
 */
export const roundedRectPath = (
  x: number,
  y: number,
  w: number,
  h: number,
  radius = 12
): string => {
  const r = Math.min(radius, w / 2, h / 2);
  const ru = r / w;
  const rv = r / h;
  const kx = ru * KAPPA;
  const ky = rv * KAPPA;
  const at = (u: number, v: number): string =>
    `${number(x + u * w)} ${number(y + v * h)}`;

  return [
    `M ${at(ru, 0)}`,
    `L ${at(1 - ru, 0)}`,
    `C ${at(1 - ru + kx, 0)} ${at(1, rv - ky)} ${at(1, rv)}`,
    `L ${at(1, 1 - rv)}`,
    `C ${at(1, 1 - rv + ky)} ${at(1 - ru + kx, 1)} ${at(1 - ru, 1)}`,
    `L ${at(ru, 1)}`,
    `C ${at(ru - kx, 1)} ${at(0, 1 - rv + ky)} ${at(0, 1 - rv)}`,
    `L ${at(0, rv)}`,
    `C ${at(0, rv - ky)} ${at(ru - kx, 0)} ${at(ru, 0)}`,
  ].join(' ');
};
