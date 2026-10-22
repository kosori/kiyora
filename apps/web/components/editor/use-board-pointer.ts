'use client';

import {
  gestureModifiers,
  isInkTool,
  type Point,
  shapeAt,
  toWorld,
} from '@kiyora/editor';
import { useEditor, useView } from '@kiyora/editor/react';
import type { Camera } from '@kiyora/model';
import {
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useRef,
} from 'react';
import { usePlacement } from './use-placement';

type ElementPointerEvent = ReactPointerEvent<HTMLElement>;

type Handlers = {
  onDoubleClick: (event: ReactMouseEvent<HTMLElement>) => void;
  onPointerCancel: (event: ElementPointerEvent) => void;
  onPointerDown: (event: ElementPointerEvent) => void;
  onPointerMove: (event: ElementPointerEvent) => void;
  onPointerUp: (event: ElementPointerEvent) => void;
};

/** Where a pointer event lands on the board: the surface rect, then the camera. */
const boardPoint = (
  event: ReactMouseEvent<HTMLElement>,
  camera: Camera
): Point => {
  const box = event.currentTarget.getBoundingClientRect();

  return toWorld(camera, {
    x: event.clientX - box.left,
    y: event.clientY - box.top,
  });
};

/**
 * The pressure a pointer reports, or `undefined` when the device does not report
 * one. A mouse always reports half a press, and a finger reports a contact size
 * rather than a press, so only a pen's value shapes the stroke; the rest stay
 * even instead of faking variation from a constant.
 */
const pressureOf = (
  event: ReactPointerEvent<HTMLElement>
): number | undefined =>
  event.pointerType === 'pen' ? event.pressure : undefined;

/**
 * The pointer on the canvas, split by tool: a shape tool places, the select
 * tool picks and moves, and an ink tool draws a freehand stroke. A drag of the
 * select tool becomes a move when it starts on a shape and a marquee when it
 * starts on empty canvas, so the engine owns that decision and the surface only
 * forwards where the pointer is — and, for a pen, the pressure it reports. A
 * double click on a shape opens its label for editing, on the canvas. Alt is
 * forwarded so a locked shape can be reached, which is the only way to unlock
 * it.
 *
 * Only the primary button begins a gesture, so a right-click hands the pointer
 * to the context menu instead of placing, moving or marqueing under it.
 *
 * `panning` is true while space is held or the hand tool is up; the camera is
 * driving then, and the selection must not fight it for the same drag.
 */
export const useBoardPointer = (
  panning: boolean,
  onEditShape: (id: string) => void
): Handlers => {
  const editor = useEditor();
  const { camera, tool } = useView();
  const placement = usePlacement(onEditShape);
  const selecting = useRef<boolean>(false);

  const onPointerDown = useCallback(
    (event: ElementPointerEvent) => {
      if (event.button !== 0) {
        return;
      }
      placement.onPointerDown(event);
      if (panning || (tool !== 'select' && !isInkTool(tool))) {
        return;
      }
      if (!(event.target instanceof SVGElement)) {
        return;
      }
      editor.pointerDown(
        boardPoint(event, camera),
        event.shiftKey,
        event.altKey,
        pressureOf(event)
      );
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
      editor.pointerMove(
        boardPoint(event, camera),
        gestureModifiers(event),
        pressureOf(event)
      );
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

  const onDoubleClick = useCallback(
    (event: ReactMouseEvent<HTMLElement>) => {
      if (panning || tool !== 'select' || event.button !== 0) {
        return;
      }
      const hit = shapeAt(editor.getBoard().shapes, boardPoint(event, camera));
      if (hit !== null) {
        onEditShape(hit.id);
      }
    },
    [camera, editor, onEditShape, panning, tool]
  );

  return {
    onDoubleClick,
    onPointerCancel,
    onPointerDown,
    onPointerMove,
    onPointerUp,
  };
};
