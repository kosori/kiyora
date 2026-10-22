'use client';

import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

/** How long the mark lingers after the pointer lifts, in milliseconds. */
const FADE_MS = 300;

/** The mark's radius in screen pixels, and the colour it is painted in. */
const RADIUS = 9;
const COLOUR = '#e11d48';

/** Where the laser is, in the slide surface's own pixels. */
type Mark = {
  x: number;
  y: number;
};

/**
 * The presenter's laser. It is always on while presenting — a pointer that
 * draws only behind a held key is not a pointer — and it is display state of
 * this component alone: the mark is a circle in a sibling of the slide, so the
 * board, the export and the history never see it, and it dies with the overlay
 * because it lives only while presenting.
 *
 * A press starts the mark where the pointer is, a move carries it, and a lift
 * fades it out. `prefers-reduced-motion` shortens that fade to nothing through
 * the same blanket rule the rest of the chrome answers to.
 */
export const PresentLaser = () => {
  const [mark, setMark] = useState<Mark | null>(null);
  const [fading, setFading] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopTimer = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  useEffect(() => stopTimer, [stopTimer]);

  const pointOf = (event: ReactPointerEvent<HTMLDivElement>): Mark => {
    const box = event.currentTarget.getBoundingClientRect();

    return { x: event.clientX - box.left, y: event.clientY - box.top };
  };

  const start = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }
    stopTimer();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrawing(true);
    setFading(false);
    setMark(pointOf(event));
  };

  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (drawing) {
      setMark(pointOf(event));
    }
  };

  const lift = () => {
    if (!drawing) {
      return;
    }
    setDrawing(false);
    setFading(true);
    timer.current = setTimeout(() => {
      setMark(null);
      setFading(false);
      timer.current = null;
    }, FADE_MS);
  };

  return (
    <div
      className='absolute inset-0 touch-none'
      data-testid='present-laser-surface'
      onPointerCancel={lift}
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={lift}
    >
      {mark === null ? null : (
        <svg
          aria-hidden='true'
          className='pointer-events-none absolute inset-0 h-full w-full'
        >
          <circle
            className={`transition-opacity duration-300 ${fading ? 'opacity-0' : 'opacity-90'}`}
            cx={mark.x}
            cy={mark.y}
            data-testid='present-laser'
            fill={COLOUR}
            r={RADIUS}
          />
        </svg>
      )}
    </div>
  );
};
