'use client';

import { GRID, NUDGE_STEP } from '@kiyora/editor';
import { useEditor } from '@kiyora/editor/react';
import { useEffect } from 'react';

const TYPING = ['INPUT', 'SELECT', 'TEXTAREA'];

/** The board-unit step each arrow moves, before the shift key coarsens it. */
const ARROWS: Record<string, { dx: number; dy: number }> = {
  ArrowDown: { dx: 0, dy: 1 },
  ArrowLeft: { dx: -1, dy: 0 },
  ArrowRight: { dx: 1, dy: 0 },
  ArrowUp: { dx: 0, dy: -1 },
};

const isTyping = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable || TYPING.includes(target.tagName));

/**
 * The board's own keys: the arrows nudge the selection, a shift-arrow by a whole
 * grid step, and Escape cancels a gesture in progress. They are not in the
 * keymap yet, so they get their own listener beside the one that reads it; a
 * pointer drag bypasses the snap with Alt, and the arrows do not, because a
 * nudge is already the fine step.
 */
export const useSelectionKeys = (): void => {
  const editor = useEditor();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || isTyping(event.target)) {
        return;
      }
      if (event.key === 'Escape') {
        editor.cancelGesture();
        return;
      }
      const arrow = ARROWS[event.key];
      if (arrow === undefined) {
        return;
      }
      const step = event.shiftKey ? GRID : NUDGE_STEP;
      event.preventDefault();
      editor.nudge(arrow.dx * step, arrow.dy * step);
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [editor]);
};
