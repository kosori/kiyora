'use client';

import { useBoard } from '@kiyora/editor/react';
import type { IconSet } from '@kiyora/model';
import { useEffect, useState } from 'react';
import { boardUsesIcons, loadIconModule } from '~/lib/icon-set';

/**
 * The icon dataset once a board needs it. A board with no icon never fetches
 * it, and a board that opens with one fetches after its first paint and
 * repaints when the paths arrive — so the library is never in the first paint
 * and an icon restored from storage still draws.
 */
export const useIconSet = (): IconSet | undefined => {
  const board = useBoard();
  const needed = boardUsesIcons(board);
  const [icons, setIcons] = useState<IconSet | undefined>(undefined);

  useEffect(() => {
    if (!needed) {
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
  }, [needed]);

  return icons;
};
