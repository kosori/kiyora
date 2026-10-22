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
      aria-label='Board'
      className='flex flex-col gap-2 border-border border-t pt-3'
      data-testid='board-settings'
    >
      <h2 className='font-heading font-medium text-sm'>Board</h2>
      <OptionButtons
        label='Board theme'
        onPick={editor.setTheme}
        options={THEME_OPTIONS}
        selected={board.settings.theme}
        testId='board-theme'
      />
      <p className='text-muted-foreground text-xs'>
        Saved with the board and used by its exports.
      </p>
    </section>
  );
};
