'use client';

import type { Board } from '@kiyora/model';
import {
  boardBounds,
  CANVAS_ENTRY,
  type IconSet,
  paintBoard,
} from '@kiyora/model';
import { useEffect, useMemo, useState } from 'react';
import { PaintNode } from '~/components/editor/paint-node';
import { boardUsesIcons, loadIconModule } from '~/lib/icon-set';
import { createTextMeasurer } from '~/lib/text-measurer';

type Props = {
  board: Board;
};

const paddedViewBox = (board: Board): string => {
  const bounds = boardBounds(board);

  if (bounds === null) {
    return '0 0 1000 700';
  }

  const padding = Math.max(32, Math.max(bounds.w, bounds.h) * 0.06);

  return [
    bounds.x - padding,
    bounds.y - padding,
    bounds.w + padding * 2,
    bounds.h + padding * 2,
  ].join(' ');
};

/**
 * A shared board's paint, with no engine and no chrome around it. The walker is
 * the canvas's own, handed the same payload, files, icons and measurer, so a
 * visitor sees what the author sees; there is no selection, no pointer handler
 * and no autosave to write anything back.
 *
 * The paint waits one effect because measurement needs the DOM. The server
 * render is the board's canvas and frame, so the first paint is safe signed out;
 * the shapes arrive as soon as the browser can measure their labels.
 */
export const ShareViewer = ({ board }: Props) => {
  const [ready, setReady] = useState(false);
  const [icons, setIcons] = useState<IconSet | undefined>(undefined);
  const measure = useMemo(() => createTextMeasurer(), []);
  const { theme } = board.settings;

  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    if (!boardUsesIcons(board)) {
      return;
    }

    let live = true;
    loadIconModule()
      .then(({ ICONS }) => {
        if (live) {
          setIcons(ICONS);
        }
      })
      .catch(() => undefined);

    return () => {
      live = false;
    };
  }, [board]);

  const paint = useMemo(
    () =>
      ready
        ? paintBoard(board, {
            files: board.files,
            icons,
            measure,
            theme,
          })
        : null,
    [board, icons, measure, ready, theme]
  );

  return (
    <main
      className='h-svh w-full overflow-hidden'
      data-testid='share-surface'
      style={{ backgroundColor: CANVAS_ENTRY[theme] }}
    >
      <svg
        aria-label={board.title || 'Shared board'}
        className='h-full w-full'
        data-testid='share-board'
        preserveAspectRatio='xMidYMid meet'
        role='img'
        viewBox={paddedViewBox(board)}
        xmlns='http://www.w3.org/2000/svg'
      >
        {paint === null ? null : <PaintNode paint={paint} />}
      </svg>
    </main>
  );
};
