'use client';

import { resolveColor } from '@kiyora/dsl';
import type { PaletteColour } from '@kiyora/model';
import {
  type ChangeEvent,
  type KeyboardEvent,
  useCallback,
  useState,
} from 'react';

type Props = {
  onPick: (colour: PaletteColour) => void;
};

/**
 * A colour a person types: a hex code, a CSS name or a palette name. The
 * grammar resolves it, so any colour snaps to the nearest palette hue rather
 * than reaching the board. A value that reaches no hue is refused out loud.
 */
export const ColourField = ({ onPick }: Props) => {
  const [text, setText] = useState('');
  const [invalid, setInvalid] = useState(false);

  const apply = useCallback(() => {
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      setInvalid(false);
      return;
    }
    const colour = resolveColor(trimmed);
    if (colour === null) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setText('');
    onPick(colour);
  }, [onPick, text]);

  const change = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setText(event.target.value);
    setInvalid(false);
  }, []);

  const keyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        apply();
      }
    },
    [apply]
  );

  return (
    <div className='flex flex-col gap-1'>
      <label className='text-muted-foreground text-xs' htmlFor='type-colour'>
        Type a colour
      </label>
      <input
        aria-invalid={invalid ? 'true' : undefined}
        className='rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50'
        data-testid='type-colour'
        id='type-colour'
        onBlur={apply}
        onChange={change}
        onKeyDown={keyDown}
        placeholder='#1971c2, crimson'
        type='text'
        value={text}
      />
      {invalid ? (
        <span
          className='text-destructive text-xs'
          data-testid='type-colour-error'
        >
          That is not a colour
        </span>
      ) : null}
    </div>
  );
};
