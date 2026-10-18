'use client';

import {
  fitCamera,
  type Point,
  panBy,
  resetCamera,
  stepZoom,
  type View,
  type Viewport,
  viewCentre,
  wheelZoom,
} from '@kiyora/editor';
import { useBoard, useEditor, useView } from '@kiyora/editor/react';
import { boardBounds } from '@kiyora/model';
import {
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from 'react';

const TYPING = ['INPUT', 'SELECT', 'TEXTAREA'];

type Handlers = {
  onPointerCancel: (event: ReactPointerEvent<SVGSVGElement>) => void;
  onPointerDown: (event: ReactPointerEvent<SVGSVGElement>) => void;
  onPointerMove: (event: ReactPointerEvent<SVGSVGElement>) => void;
  onPointerUp: (event: ReactPointerEvent<SVGSVGElement>) => void;
};

type Actions = {
  fit: () => void;
  reset: () => void;
  toggleTool: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
};

/** Everything the canvas surface needs to drive the camera, and nothing about the board. */
export type CameraSurface = {
  actions: Actions;
  hand: boolean;
  handlers: Handlers;
  /** Whether the canvas has measured itself, which every camera action needs. */
  ready: boolean;
  ref: RefObject<SVGSVGElement | null>;
  view: View;
};

/** A pointer's position in the canvas's own pixels, whatever the page scrolled to. */
const localPoint = (
  element: Element | null,
  clientX: number,
  clientY: number
): Point => {
  const box = element?.getBoundingClientRect();
  return { x: clientX - (box?.left ?? 0), y: clientY - (box?.top ?? 0) };
};

const isTyping = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable || TYPING.includes(target.tagName));

/**
 * The camera's gestures, bound to the canvas itself: the wheel and the keyboard
 * zoom about the pointer, and a drag pans when the hand tool is up, space is
 * held, or the middle button is down. Every one of them moves the view and leaves
 * the board alone.
 */
export const useCameraSurface = (): CameraSurface => {
  const editor = useEditor();
  const board = useBoard();
  const view = useView();
  const ref = useRef<SVGSVGElement | null>(null);
  const size = useRef<Viewport>({ h: 0, w: 0 });
  const pointer = useRef<Point>({ x: 0, y: 0 });
  const space = useRef(false);
  const drag = useRef<{ id: number; last: Point } | null>(null);
  const hasPointer = useRef<boolean>(false);
  const [ready, setReady] = useState(false);
  const [spaceHeld, setSpaceHeld] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (element === null) {
      return;
    }
    const measure = () => {
      const box = element.getBoundingClientRect();
      size.current = { h: box.height, w: box.width };
      setReady(box.width > 0 && box.height > 0);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const element = ref.current;
    if (element === null) {
      return;
    }
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const anchor = localPoint(element, event.clientX, event.clientY);
      pointer.current = anchor;
      hasPointer.current = true;
      editor.setCamera(
        wheelZoom(editor.getView().camera, anchor, event.deltaY)
      );
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, [editor]);

  useEffect(() => {
    const anchor = (): Point =>
      hasPointer.current ? pointer.current : viewCentre(size.current);
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTyping(event.target)) {
        return;
      }
      if (event.code === 'Space') {
        space.current = true;
        setSpaceHeld(true);
        event.preventDefault();
        return;
      }
      if (event.key === '=' || event.key === '+') {
        editor.setCamera(stepZoom(editor.getView().camera, anchor(), 1));
        event.preventDefault();
        return;
      }
      if (event.key === '-' || event.key === '_') {
        editor.setCamera(stepZoom(editor.getView().camera, anchor(), -1));
        event.preventDefault();
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        space.current = false;
        setSpaceHeld(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [editor]);

  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    const panning =
      event.button === 1 || space.current || editor.getView().tool === 'hand';
    if (!panning) {
      return;
    }
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      id: event.pointerId,
      last: localPoint(event.currentTarget, event.clientX, event.clientY),
    };
  };

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const here = localPoint(event.currentTarget, event.clientX, event.clientY);
    pointer.current = here;
    hasPointer.current = true;
    const active = drag.current;
    if (active === null || active.id !== event.pointerId) {
      return;
    }
    editor.setCamera(
      panBy(editor.getView().camera, {
        x: here.x - active.last.x,
        y: here.y - active.last.y,
      })
    );
    drag.current = { id: active.id, last: here };
  };

  const onPointerEnd = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (drag.current?.id !== event.pointerId) {
      return;
    }
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const hand = spaceHeld || view.tool === 'hand';

  return {
    actions: {
      fit: () => {
        editor.setCamera(fitCamera(boardBounds(board), size.current));
      },
      reset: () => {
        editor.setCamera(resetCamera(editor.getView().camera, size.current));
      },
      toggleTool: () => {
        editor.setTool(editor.getView().tool === 'hand' ? 'select' : 'hand');
      },
      zoomIn: () => {
        editor.setCamera(
          stepZoom(editor.getView().camera, viewCentre(size.current), 1)
        );
      },
      zoomOut: () => {
        editor.setCamera(
          stepZoom(editor.getView().camera, viewCentre(size.current), -1)
        );
      },
    },
    hand,
    handlers: {
      onPointerCancel: onPointerEnd,
      onPointerDown,
      onPointerMove,
      onPointerUp: onPointerEnd,
    },
    ready,
    ref,
    view,
  };
};
