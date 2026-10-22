/** A point in board coordinates. */
export type Point = {
  x: number;
  y: number;
};

/** `point` turned `degrees` about `origin`. */
export const turn = (point: Point, origin: Point, degrees: number): Point => {
  if (degrees === 0) {
    return point;
  }
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const dx = point.x - origin.x;
  const dy = point.y - origin.y;

  return {
    x: origin.x + dx * cos - dy * sin,
    y: origin.y + dx * sin + dy * cos,
  };
};
