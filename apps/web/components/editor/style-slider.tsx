'use client';

import { type ChangeEvent, useCallback } from 'react';

type Props = {
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  testId: string;
  value: number;
};

/** A bounded style value, with the number in view so the value is never a guess. */
export const StyleSlider = ({
  label,
  max,
  min,
  onChange,
  testId,
  value,
}: Props) => {
  const change = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      onChange(Number(event.target.value));
    },
    [onChange]
  );

  return (
    <div className='flex flex-col gap-1'>
      <span className='flex items-center justify-between text-muted-foreground text-xs'>
        <span>{label}</span>
        <span className='tabular-nums' data-testid={`${testId}-value`}>
          {value}
        </span>
      </span>
      <input
        aria-label={label}
        className='h-1.5 w-full cursor-pointer accent-primary'
        data-testid={testId}
        max={max}
        min={min}
        onChange={change}
        step={1}
        type='range'
        value={value}
      />
    </div>
  );
};
