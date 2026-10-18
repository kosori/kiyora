'use client';

import type { Placement, Point } from '@kiyora/editor';
import { useBoard, useEditor, useTool } from '@kiyora/editor/react';
import type { Camera } from '@kiyora/model';
import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useRef,
} from 'react';

/**
 * Where a pointer event lands on the board: the canvas rect takes it into the
 * canvas, and the camera takes it onto the board.
 */
const boardPoint = (
  event: ReactPointerEvent<SVGSVGElement>,
  camera: Camera
): Point => {
  const rect = event.currentTarget.getBoundingClientRect();

  return {
    x: camera.x + (event.clientX - rect.left) / camera.zoom,
    y: camera.y + (event.clientY - rect.top) / camera.zoom,
  };
};

type PlacementHandlers = {
  onPointerDown: (event: ReactPointerEvent<SVGSVGElement>) => void;
  onPointerUp: (event: ReactPointerEvent<SVGSVGElement>) => void;
};

/** Canvas drag handling: a gesture with a shape tool places exactly one shape. */
export const usePlacement = (): PlacementHandlers => {
  const editor = useEditor();
  const tool = useTool();
  const { camera } = useBoard();
  const start = useRef<Point | null>(null);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<SVGSVGElement>) => {
      if (tool === 'select') {
        return;
      }
      start.current = boardPoint(event, camera);
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [camera, tool]
  );

  const onPointerUp = useCallback(
    (event: ReactPointerEvent<SVGSVGElement>) => {
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
