'use client';

import { findMatches, focusCamera, type Viewport } from '@kiyora/editor';
import { useBoard, useEditor } from '@kiyora/editor/react';
import { shapeBounds } from '@kiyora/model';
import {
  type ChangeEvent as ReactChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

type Props = {
  /** Closes the box and leaves the selection where the last match put it. */
  onClose: () => void;
  /** The canvas's own size, so a match can be framed in the view it sits in. */
  viewport: Viewport;
};

/**
 * Find on the canvas. It searches authored text only, selects the first match
 * and frames it, and Enter advances through the rest, wrapping at the end. The
 * query stays local to the box: closing it leaves the board, the camera and the
 * selection exactly as the last match left them.
 *
 * The box is an input, so it takes the keyboard while it is open. Closing it
 * unmounts the input, which returns the keyboard to the canvas. Mod+F pressed
 * inside the field is swallowed, so the box cannot reopen from its own input.
 */
export const FindBox = ({ onClose, viewport }: Props) => {
  const editor = useEditor();
  const board = useBoard();
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const matches = useMemo(() => findMatches(board, query), [board, query]);

  useEffect(() => {
    input.current?.focus();
  }, []);

  useEffect(() => {
    const match = matches[index];
    if (match === undefined) {
      return;
    }
    editor.setSelection([match.id]);
    if (viewport.w > 0 && viewport.h > 0) {
      editor.setCamera(focusCamera(shapeBounds(match, board.shapes), viewport));
    }
  }, [board, editor, index, matches, viewport]);

  const onChange = useCallback((event: ReactChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
    setIndex(0);
  }, []);

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        if (matches.length > 0) {
          setIndex((current) => (current + 1) % matches.length);
        }
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f') {
        event.preventDefault();
      }
    },
    [matches.length, onClose]
  );

  return (
    <div
      className='absolute top-3 left-1/2 z-30 w-72 -translate-x-1/2 rounded-lg border border-border bg-background/95 p-1.5 shadow-sm backdrop-blur'
      data-testid='find'
    >
      <input
        aria-label='Find on board'
        autoComplete='off'
        className='w-full bg-transparent px-2 py-1 text-foreground text-sm outline-none placeholder:text-muted-foreground'
        data-testid='find-input'
        onChange={onChange}
        onKeyDown={onKeyDown}
        placeholder='Find authored text'
        ref={input}
        type='search'
        value={query}
      />
    </div>
  );
};
