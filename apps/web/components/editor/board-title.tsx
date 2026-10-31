'use client';

import type { LibraryEntry } from '@kiyora/editor';
import { useBoard, useEditor } from '@kiyora/editor/react';
import {
  type ChangeEvent,
  type FocusEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from 'react';

export type BoardTitleProps = {
  /** Commits a new name through the library. Null when the board is not held. */
  rename: (title: string) => Promise<LibraryEntry | null>;
};

/**
 * The open board's name, editable in place. A commit writes the same rename the
 * library row does — payload first, record after — so the two can never disagree
 * after a reload. The engine adopts the name without a history entry, so undo
 * keeps the board's paint and never puts an older name back.
 */
export const BoardTitle = ({ rename }: BoardTitleProps) => {
  const editor = useEditor();
  const board = useBoard();
  const [draft, setDraft] = useState(board.title);
  const settled = useRef<boolean>(false);

  useEffect(() => {
    setDraft(board.title);
  }, [board.title]);

  const commit = async (): Promise<void> => {
    if (settled.current) {
      return;
    }
    settled.current = true;
    const next = draft.trim();
    if (next === '' || next === board.title) {
      setDraft(board.title);
      return;
    }
    try {
      const entry = await rename(next);
      if (entry === null) {
        setDraft(board.title);
        return;
      }
      editor.setTitle(entry.title);
    } catch {
      setDraft(board.title);
    }
  };

  const change = (event: ChangeEvent<HTMLInputElement>): void => {
    settled.current = false;
    setDraft(event.target.value);
  };

  const blur = (): void => {
    commit().catch(() => undefined);
  };

  const focus = (event: FocusEvent<HTMLInputElement>): void => {
    settled.current = false;
    event.currentTarget.select();
  };

  const keyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commit().catch(() => undefined);
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      settled.current = true;
      setDraft(board.title);
      event.currentTarget.blur();
    }
  };

  return (
    <div className='flex min-w-0 items-center'>
      <input
        aria-label='Board title'
        className='w-56 min-w-0 rounded-lg bg-transparent px-2 py-1 font-medium text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50'
        data-testid='board-title'
        onBlur={blur}
        onChange={change}
        onFocus={focus}
        onKeyDown={keyDown}
        value={draft}
      />
    </div>
  );
};
