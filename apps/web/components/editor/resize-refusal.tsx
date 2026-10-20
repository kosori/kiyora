'use client';

import { useGesture } from '@kiyora/editor/react';

/**
 * The reason a resize is refused, read from the open gesture. A turned shape
 * cannot take a one-way scale, so the drag says why instead of writing an
 * approximate box; the notice disappears with the gesture that opened it.
 */
export const ResizeRefusal = () => {
  const gesture = useGesture();

  if (gesture.kind !== 'resize' || gesture.refusal === undefined) {
    return null;
  }

  return (
    <p
      aria-live='polite'
      className='pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-destructive/40 bg-destructive/10 px-2.5 py-1 text-destructive text-xs shadow-sm backdrop-blur'
      data-testid='resize-refusal'
      role='status'
    >
      {gesture.refusal}
    </p>
  );
};
