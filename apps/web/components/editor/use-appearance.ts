'use client';

import { useCallback, useEffect, useState } from 'react';

/** The chrome's light or dark setting. `system` follows the OS until a person chooses. */
export type Appearance = 'dark' | 'light' | 'system';

/** Where this browser keeps the appearance it chose. Never a board key. */
export const APPEARANCE_KEY = 'kiyora:appearance';

/** Whether `value` is an appearance a person can have chosen. */
const isAppearance = (value: string | null): value is Appearance =>
  value === 'dark' || value === 'light' || value === 'system';

/** The appearance this browser last stored, or `system` when it has not chosen. */
const storedAppearance = (): Appearance => {
  try {
    const value = localStorage.getItem(APPEARANCE_KEY);
    return isAppearance(value) ? value : 'system';
  } catch {
    return 'system';
  }
};

/**
 * The chrome's appearance: `system` until the person picks light or dark, then
 * their choice, kept in this browser. It toggles `.dark` on the document root
 * and nothing else, so no board, autosave or export can read it.
 *
 * The system option follows the OS while it is in force, so a person who has
 * not chosen and switches their desktop at sunset sees the app follow.
 */
export const useAppearance = (): {
  appearance: Appearance;
  setAppearance: (next: Appearance) => void;
} => {
  const [appearance, setChoice] = useState<Appearance>('system');

  useEffect(() => {
    setChoice(storedAppearance());
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = (): void => {
      const dark =
        appearance === 'dark' || (appearance === 'system' && media.matches);
      document.documentElement.classList.toggle('dark', dark);
    };

    apply();
    if (appearance !== 'system') {
      return;
    }
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [appearance]);

  const setAppearance = useCallback((next: Appearance) => {
    setChoice(next);
    try {
      localStorage.setItem(APPEARANCE_KEY, next);
    } catch {
      // Storage refused the write; the choice still holds for this tab.
    }
  }, []);

  return { appearance, setAppearance };
};
