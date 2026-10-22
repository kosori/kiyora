'use client';

import { useCallback } from 'react';
import { IconGlyph } from './icon-glyph';

type Props = {
  name: string;
  onChoose: (name: string) => void;
  paths: string;
  viewBox: number;
};

/**
 * One icon in the picker's grid: it previews the path the canvas will paint and
 * hands its name back when chosen. Its label is the name read as words, so the
 * menu announces what a person sees rather than a file's spelling.
 */
export const IconPickerItem = ({ name, onChoose, paths, viewBox }: Props) => {
  const choose = useCallback(() => onChoose(name), [name, onChoose]);
  const words = name.replaceAll('-', ' ');
  const label = `${words.charAt(0).toUpperCase()}${words.slice(1)}`;

  return (
    <button
      aria-label={label}
      className='flex h-10 items-center justify-center rounded hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
      onClick={choose}
      role='menuitem'
      title={name}
      type='button'
    >
      <IconGlyph paths={paths} viewBox={viewBox} />
    </button>
  );
};
