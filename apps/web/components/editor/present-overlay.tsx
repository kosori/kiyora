'use client';

import { useBoard, useEditor, usePresent } from '@kiyora/editor/react';
import { paintBoard, presentedSlides } from '@kiyora/model';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createTextMeasurer } from '~/lib/text-measurer';
import { PaintNode } from './paint-node';

/** Seconds as `m:ss`, however long a talk runs. */
const formatElapsed = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;

  return `${minutes}:${String(rest).padStart(2, '0')}`;
};

/**
 * Presenting: the deck played fullscreen in this window, one slide at a time.
 * The slide is the frame's own paint, so a slide looks exactly like the region
 * of the board it came from, and the camera is never moved — presenting reads
 * the board and writes nothing, so it leaves no history entry and no save.
 *
 * Notes and the timer ride in the same overlay rather than a second window, and
 * every key that drives it is a keymap binding, resolved by the one listener.
 */
export const PresentOverlay = () => {
  const editor = useEditor();
  const board = useBoard();
  const present = usePresent();
  const measure = useMemo(() => createTextMeasurer(), []);
  const root = useRef<HTMLDivElement>(null);
  const [seconds, setSeconds] = useState(0);

  const onExit = useCallback(() => editor.stopPresent(), [editor]);

  const slides = presentedSlides(board);
  const slide = present.active ? slides[present.index] : undefined;

  const paint = useMemo(
    () => paintBoard(board, { measure, theme: board.settings.theme }),
    [board, measure]
  );

  useEffect(() => {
    if (!present.active) {
      return;
    }
    const element = root.current;
    const request = element?.requestFullscreen?.();
    request?.catch(() => undefined);

    const onFullscreen = () => {
      if (document.fullscreenElement === null) {
        editor.stopPresent();
      }
    };
    document.addEventListener('fullscreenchange', onFullscreen);

    return () => {
      document.removeEventListener('fullscreenchange', onFullscreen);
      if (document.fullscreenElement !== null) {
        const exit = document.exitFullscreen?.();
        exit?.catch(() => undefined);
      }
    };
  }, [editor, present.active]);

  useEffect(() => {
    if (!present.active) {
      return;
    }
    const tick = setInterval(() => setSeconds((value) => value + 1), 1000);

    return () => clearInterval(tick);
  }, [present.active]);

  if (slide === undefined) {
    return null;
  }

  const node = paint.children.find((child) => child.shapeId === slide.frame.id);

  return (
    <div
      aria-label='Presenting'
      aria-modal='true'
      className='fixed inset-0 z-50 flex flex-col bg-background text-foreground'
      data-testid='present-overlay'
      ref={root}
      role='dialog'
    >
      <svg
        aria-label='Slide'
        className='min-h-0 flex-1'
        data-testid='present-slide'
        preserveAspectRatio='xMidYMid meet'
        role='img'
        viewBox={`${slide.frame.x} ${slide.frame.y} ${slide.frame.w} ${slide.frame.h}`}
      >
        {node === undefined ? null : <PaintNode paint={node} />}
      </svg>
      <div className='flex shrink-0 items-start gap-6 border-border border-t p-4'>
        {present.notes ? (
          <p
            className='min-h-12 flex-1 whitespace-pre-wrap text-sm'
            data-testid='present-notes'
          >
            {slide.slide.notes}
          </p>
        ) : null}
        <span
          className='font-mono text-sm tabular-nums'
          data-testid='present-timer'
        >
          {formatElapsed(seconds)}
        </span>
        <span
          className='font-mono text-muted-foreground text-sm tabular-nums'
          data-testid='present-counter'
        >
          {present.index + 1} / {slides.length}
        </span>
        <button
          className='rounded border border-border px-2 py-1 text-sm'
          data-testid='present-exit'
          onClick={onExit}
          type='button'
        >
          Exit
        </button>
      </div>
    </div>
  );
};
