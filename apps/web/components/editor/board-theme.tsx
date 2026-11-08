'use client';

import { useBoard, useEditor } from '@kiyora/editor/react';
import type { Theme } from '@kiyora/model';
import { OptionButtons } from './option-buttons';

const THEME_OPTIONS: readonly { label: string; value: Theme }[] = [
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
];

/**
 * The board's theme: the canvas it is authored on, saved with it, and the one
 * its export follows. It is board state, so it is one history entry and reaches
 * autosave, unlike the chrome's appearance.
 */
export const BoardTheme = () => {
  const board = useBoard();
  const editor = useEditor();

  return (
    <section
      aria-label='Board theme'
      className='flex flex-col gap-2 px-2 py-1'
      data-testid='board-settings'
    >
      <h2 className='font-medium text-muted-foreground text-xs'>Board theme</h2>
      <OptionButtons
        label='Board theme'
        onPick={editor.setTheme}
        options={THEME_OPTIONS}
        selected={board.settings.theme}
        testId='board-theme'
      />
    </section>
  );
};
