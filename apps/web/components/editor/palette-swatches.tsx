'use client';

import {
  FOREGROUND,
  FOREGROUND_ENTRY,
  PALETTE,
  PALETTE_COLOURS,
  type PaletteColour,
  type Theme,
} from '@kiyora/model';
import { cn } from 'cn';
import { type MouseEvent, useCallback } from 'react';

type Props = {
  label: string;
  onInk?: () => void;
  onPick: (colour: PaletteColour) => void;
  selected: PaletteColour | typeof FOREGROUND;
  testId: string;
  theme: Theme;
};

const SWATCH =
  'size-6 rounded-full border border-border outline-none focus-visible:ring-3 focus-visible:ring-ring/50';

/** One swatch reads as pressed when its colour is the one in force. */
const selectedRing = (chosen: boolean): string =>
  cn(chosen && 'ring-2 ring-ring ring-offset-1 ring-offset-background');

/**
 * The nine palette colours, and the ink foreground when an outline offers it.
 * Every value comes from the grammar's palette, so the panel can never name a
 * colour the rest of the board does not know.
 */
export const PaletteSwatches = ({
  label,
  onInk,
  onPick,
  selected,
  testId,
  theme,
}: Props) => {
  const pick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const index = Number(event.currentTarget.dataset.index);
      const colour = PALETTE_COLOURS[index];
      if (colour !== undefined) {
        onPick(colour);
      }
    },
    [onPick]
  );

  return (
    <fieldset
      aria-label={label}
      className='m-0 flex min-w-0 flex-wrap gap-1 border-0 p-0'
    >
      {onInk === undefined ? null : (
        <button
          aria-label={`${label} ink`}
          aria-pressed={selected === FOREGROUND}
          className={cn(SWATCH, selectedRing(selected === FOREGROUND))}
          data-testid={`${testId}-ink`}
          onClick={onInk}
          style={{ backgroundColor: FOREGROUND_ENTRY[theme] }}
          type='button'
        />
      )}
      {PALETTE_COLOURS.map((colour, index) => (
        <button
          aria-label={`${label} ${colour}`}
          aria-pressed={selected === colour}
          className={cn(SWATCH, selectedRing(selected === colour))}
          data-index={index}
          data-testid={`${testId}-${colour}`}
          key={colour}
          onClick={pick}
          style={{ backgroundColor: PALETTE[colour][theme] }}
          type='button'
        />
      ))}
    </fieldset>
  );
};
