'use client';

import type { FigureKind } from '@kiyora/model';
import { useCallback } from 'react';
import { Button } from '~/components/ui/button';

type Props = {
  kind: FigureKind;
  onChoose: (kind: FigureKind) => void;
  selected: boolean;
};

/** A kind's name as a person reads it: `predefined-process` to `Predefined Process`. */
export const figureLabel = (kind: FigureKind): string =>
  kind
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

/** One menu entry: it names a kind, and choosing it hands that kind back. */
export const ShapePickerItem = ({ kind, onChoose, selected }: Props) => {
  const choose = useCallback(() => onChoose(kind), [kind, onChoose]);

  return (
    <Button
      className='justify-start'
      onClick={choose}
      role='menuitem'
      size='sm'
      variant={selected ? 'secondary' : 'ghost'}
    >
      {figureLabel(kind)}
    </Button>
  );
};
