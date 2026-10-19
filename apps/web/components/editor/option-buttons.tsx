'use client';

import { cn } from 'cn';
import { type MouseEvent, useCallback } from 'react';

type Option<T extends string> = {
  label: string;
  value: T;
};

type Props<T extends string> = {
  label: string;
  onPick: (value: T) => void;
  options: readonly Option<T>[];
  selected: T | null;
  testId: string;
};

/** A row of options where one is in force: picking one hands its value back. */
export const OptionButtons = <T extends string>({
  label,
  onPick,
  options,
  selected,
  testId,
}: Props<T>) => {
  const pick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const index = Number(event.currentTarget.dataset.index);
      const option = options[index];
      if (option !== undefined) {
        onPick(option.value);
      }
    },
    [onPick, options]
  );

  return (
    <fieldset
      aria-label={label}
      className='m-0 flex min-w-0 flex-wrap gap-0.5 border-0 p-0'
    >
      {options.map((option, index) => (
        <button
          aria-label={`${label} ${option.label}`}
          aria-pressed={selected === option.value}
          className={cn(
            'rounded-md border border-transparent px-2 py-1 text-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
            selected === option.value
              ? 'bg-secondary text-secondary-foreground'
              : 'hover:bg-muted'
          )}
          data-index={index}
          data-testid={`${testId}-${option.value}`}
          key={option.value}
          onClick={pick}
          type='button'
        >
          {option.label}
        </button>
      ))}
    </fieldset>
  );
};
