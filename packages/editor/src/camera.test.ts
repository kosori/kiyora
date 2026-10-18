import {
  clampZoom,
  fitCamera,
  gridSpacing,
  gridStep,
  MAX_ZOOM,
  MIN_ZOOM,
  panBy,
  resetCamera,
  stepZoom,
  toScreen,
  toWorld,
  wheelZoom,
  zoomAt,
  zoomBy,
} from '@kiyora/editor';
import { describe, expect, it } from 'vitest';

const viewport = { h: 600, w: 800 };

describe('world and screen coordinates', () => {
  it('places a world point on the screen through the camera', () => {
    expect(toScreen({ x: 30, y: -10, zoom: 2 }, { x: 10, y: 5 })).toEqual({
      x: 50,
      y: 0,
    });
  });

  it('reads a screen point back as the world point under it', () => {
    expect(toWorld({ x: 30, y: -10, zoom: 2 }, { x: 50, y: 0 })).toEqual({
      x: 10,
      y: 5,
    });
  });

  it('round-trips any point at any zoom', () => {
    const camera = { x: -123.5, y: 47.25, zoom: 0.37 };
    const screen = { x: 612, y: 88 };

    expect(toScreen(camera, toWorld(camera, screen)).x).toBeCloseTo(
      screen.x,
      6
    );
    expect(toScreen(camera, toWorld(camera, screen)).y).toBeCloseTo(
      screen.y,
      6
    );
  });
});

describe('zooming', () => {
  it('keeps the world point under the pointer fixed', () => {
    const camera = { x: 0, y: 0, zoom: 1 };
    const anchor = { x: 100, y: 50 };
    const under = toWorld(camera, anchor);
    const zoomed = zoomAt(camera, anchor, 2);

    expect(zoomed.zoom).toBe(2);
    expect(toWorld(zoomed, anchor).x).toBeCloseTo(under.x, 6);
    expect(toWorld(zoomed, anchor).y).toBeCloseTo(under.y, 6);
  });

  it('holds the anchor fixed when the camera is already offset and rotated in zoom', () => {
    const camera = { x: -200, y: 75, zoom: 0.5 };
    const anchor = { x: 640, y: 360 };
    const under = toWorld(camera, anchor);

    for (const factor of [1.2, 0.4, 3, 0.83]) {
      const zoomed = zoomBy(camera, anchor, factor);

      expect(toWorld(zoomed, anchor).x).toBeCloseTo(under.x, 6);
      expect(toWorld(zoomed, anchor).y).toBeCloseTo(under.y, 6);
    }
  });

  it('refuses to zoom past the limits, and stops the anchor from drifting past them', () => {
    const camera = { x: 0, y: 0, zoom: 1 };
    const anchor = { x: 100, y: 100 };

    expect(clampZoom(0.0001)).toBe(MIN_ZOOM);
    expect(clampZoom(1000)).toBe(MAX_ZOOM);
    expect(zoomAt(camera, anchor, 1000).zoom).toBe(MAX_ZOOM);
    expect(zoomAt(camera, anchor, 0.0001).zoom).toBe(MIN_ZOOM);
  });

  it('steps by a fixed ratio for the keyboard', () => {
    const camera = { x: 0, y: 0, zoom: 1 };

    expect(stepZoom(camera, { x: 0, y: 0 }, 1).zoom).toBeCloseTo(1.2, 6);
    expect(stepZoom(camera, { x: 0, y: 0 }, -1).zoom).toBeCloseTo(1 / 1.2, 6);
  });

  it('reads a wheel up as zooming in and a wheel down as zooming out, anchored at the pointer', () => {
    const camera = { x: 0, y: 0, zoom: 1 };
    const anchor = { x: 400, y: 300 };
    const under = toWorld(camera, anchor);

    const inward = wheelZoom(camera, anchor, -100);
    const outward = wheelZoom(camera, anchor, 100);

    expect(inward.zoom).toBeCloseTo(1.2, 6);
    expect(outward.zoom).toBeCloseTo(1 / 1.2, 6);
    expect(toWorld(inward, anchor).x).toBeCloseTo(under.x, 6);
    expect(toWorld(outward, anchor).y).toBeCloseTo(under.y, 6);
  });
});

describe('panning', () => {
  it('moves the board by the pixels the pointer moved, without changing the zoom', () => {
    expect(panBy({ x: 0, y: 0, zoom: 1 }, { x: 10, y: -5 })).toEqual({
      x: 10,
      y: -5,
      zoom: 1,
    });
  });

  it('moves the same screen distance whatever the zoom', () => {
    const camera = { x: 0, y: 0, zoom: 4 };
    const panned = panBy(camera, { x: 10, y: 10 });

    expect(toScreen(panned, { x: 0, y: 0 })).toEqual({
      x: camera.x + 10,
      y: camera.y + 10,
    });
  });
});

describe('fitting the view to the contents', () => {
  const content = { h: 200, w: 400, x: 0, y: 0 };

  it('scales the contents up until the tighter axis fits, and centres the rest', () => {
    expect(fitCamera(content, viewport, 0)).toEqual({ x: 0, y: 100, zoom: 2 });
  });

  it('leaves the whole extent on screen, a margin inside the edges', () => {
    const camera = fitCamera(content, viewport, 32);
    const topLeft = toScreen(camera, { x: content.x, y: content.y });
    const bottomRight = toScreen(camera, {
      x: content.x + content.w,
      y: content.y + content.h,
    });

    expect(topLeft.x).toBeGreaterThanOrEqual(31.9);
    expect(topLeft.y).toBeGreaterThanOrEqual(31.9);
    expect(bottomRight.x).toBeLessThanOrEqual(viewport.w - 31.9);
    expect(bottomRight.y).toBeLessThanOrEqual(viewport.h - 31.9);
  });

  it('puts the middle of the contents in the middle of the viewport', () => {
    const camera = fitCamera(content, viewport, 0);
    const middle = toScreen(camera, { x: 200, y: 100 });

    expect(middle.x).toBeCloseTo(viewport.w / 2, 6);
    expect(middle.y).toBeCloseTo(viewport.h / 2, 6);
  });

  it('zooms in on a single point without dividing by an empty extent', () => {
    const camera = fitCamera({ h: 0, w: 0, x: 500, y: 500 }, viewport, 0);

    expect(Number.isFinite(camera.zoom)).toBe(true);
    expect(camera.zoom).toBe(MAX_ZOOM);
    expect(toScreen(camera, { x: 500, y: 500 })).toEqual({ x: 400, y: 300 });
  });

  it('rests on nothing when there is nothing to fit', () => {
    expect(fitCamera(null, viewport, 0)).toEqual({ x: 0, y: 0, zoom: 1 });
  });
});

describe('resetting to one hundred percent', () => {
  it('comes back to one hundred percent around whatever is in the middle', () => {
    const camera = { x: -450, y: -80, zoom: 3 };
    const middle = toWorld(camera, { x: 400, y: 300 });
    const reset = resetCamera(camera, viewport);

    expect(reset.zoom).toBe(1);
    expect(toWorld(reset, { x: 400, y: 300 }).x).toBeCloseTo(middle.x, 6);
    expect(toWorld(reset, { x: 400, y: 300 }).y).toBeCloseTo(middle.y, 6);
  });
});

describe("the grid's detail", () => {
  it('steps by halves and doubles of the base, so the grid never crowds on screen', () => {
    expect(gridStep(1)).toBe(20);
    expect(gridStep(0.5)).toBe(40);
    expect(gridStep(0.1)).toBe(160);
    expect(gridStep(4)).toBe(5);
  });

  it('reports the same step in screen pixels, so a renderer computes nothing', () => {
    expect(gridSpacing(1)).toBeCloseTo(20, 6);
    expect(gridSpacing(0.5)).toBeCloseTo(20, 6);
    expect(gridSpacing(0.1)).toBeCloseTo(16, 6);
  });

  it('thins as the view zooms out, never crowding, never vanishing', () => {
    let previous = 0;

    for (const zoom of [8, 4, 2, 1, 0.5, 0.25, 0.1]) {
      const step = gridStep(zoom);
      const spacing = gridSpacing(zoom);

      expect(step).toBeGreaterThanOrEqual(previous);
      expect(spacing).toBeGreaterThanOrEqual(16);
      expect(spacing).toBeLessThan(32);
      previous = step;
    }
  });
});
