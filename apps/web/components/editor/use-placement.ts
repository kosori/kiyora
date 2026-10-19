'use client';

import {
  type Placement,
  type Point,
  placesShape,
  toWorld,
} from '@kiyora/editor';
import { useEditor, useView } from '@kiyora/editor/react';
import type { Camera } from '@kiyora/model';
import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useRef,
} from 'react';

/** Where a pointer event lands on the board: the canvas rect, then the camera. */
const boardPoint = (
  event: ReactPointerEvent<HTMLElement>,
  camera: Camera
): Point => {
  const box = event.currentTarget.getBoundingClientRect();

  return toWorld(camera, {
    x: event.clientX - box.left,
    y: event.clientY - box.top,
  });
};

type PlacementHandlers = {
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
};

/**
 * Canvas drag handling: a gesture with a figure tool places exactly one shape.
 * Every other tool leaves the pointer alone for the camera and the selection.
 */
export const usePlacement = (): PlacementHandlers => {
  const editor = useEditor();
  const { camera, tool } = useView();
  const start = useRef<Point | null>(null);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!placesShape(tool)) {
        return;
      }
      start.current = boardPoint(event, camera);
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [camera, tool]
  );

  const onPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const from = start.current;
      start.current = null;
      if (from === null) {
        return;
      }
      const placement: Placement = { from, to: boardPoint(event, camera) };
      editor.placeShape(placement);
    },
    [camera, editor]
  );

  return { onPointerDown, onPointerUp };
};
