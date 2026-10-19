'use client';

import { gestureModifiers, type Point, toWorld } from '@kiyora/editor';
import { useEditor, useView } from '@kiyora/editor/react';
import type { Camera } from '@kiyora/model';
import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useRef,
} from 'react';
import { usePlacement } from './use-placement';

type ElementPointerEvent = ReactPointerEvent<HTMLElement>;

type Handlers = {
  onPointerCancel: (event: ElementPointerEvent) => void;
  onPointerDown: (event: ElementPointerEvent) => void;
  onPointerMove: (event: ElementPointerEvent) => void;
  onPointerUp: (event: ElementPointerEvent) => void;
};

/** Where a pointer event lands on the board: the surface rect, then the camera. */
const boardPoint = (event: ElementPointerEvent, camera: Camera): Point => {
  const box = event.currentTarget.getBoundingClientRect();

  return toWorld(camera, {
    x: event.clientX - box.left,
    y: event.clientY - box.top,
  });
};

/**
 * The pointer on the canvas, split by tool: a figure tool places, the select
 * tool picks and moves. A drag of the select tool becomes a move when it starts
 * on a shape and a marquee when it starts on empty canvas, so the engine owns
 * that decision and the surface only forwards where the pointer is.
 *
 * `panning` is true while space is held or the hand tool is up; the camera is
 * driving then, and the selection must not fight it for the same drag.
 */
export const useBoardPointer = (panning: boolean): Handlers => {
  const editor = useEditor();
  const { camera, tool } = useView();
  const placement = usePlacement();
  const selecting = useRef<boolean>(false);

  const onPointerDown = useCallback(
    (event: ElementPointerEvent) => {
      placement.onPointerDown(event);
      if (panning || tool !== 'select' || event.button !== 0) {
        return;
      }
      if (!(event.target instanceof SVGElement)) {
        return;
      }
      editor.pointerDown(boardPoint(event, camera), event.shiftKey);
      selecting.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [camera, editor, panning, placement, tool]
  );

  const onPointerMove = useCallback(
    (event: ElementPointerEvent) => {
      if (!selecting.current) {
        return;
      }
      editor.pointerMove(boardPoint(event, camera), gestureModifiers(event));
    },
    [camera, editor]
  );

  const onPointerUp = useCallback(
    (event: ElementPointerEvent) => {
      if (selecting.current) {
        selecting.current = false;
        editor.pointerUp();
      }
      placement.onPointerUp(event);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
    [editor, placement]
  );

  const onPointerCancel = useCallback(
    (event: ElementPointerEvent) => {
      if (!selecting.current) {
        return;
      }
      selecting.current = false;
      editor.cancelGesture();
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
    [editor]
  );

  return { onPointerCancel, onPointerDown, onPointerMove, onPointerUp };
};
