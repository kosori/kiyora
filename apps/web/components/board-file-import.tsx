'use client';

import type { LibraryEntry } from '@kiyora/editor';
import { type ChangeEvent, useCallback, useRef } from 'react';
import { Button } from '~/components/ui/button';
import { importBoardFile } from '~/lib/board-import';

const messageOf = (thrown: unknown): string =>
  thrown instanceof Error ? thrown.message : String(thrown);

type Props = {
  /** The button's test id, so each surface names its own action. */
  buttonTestId: string;
  /** The hidden file input's test id. */
  inputTestId: string;
  /** Runs once the board is stored, with the entry the library now holds. */
  onImported: (entry: LibraryEntry) => void;
  /** Names the refusal that stopped an import. */
  onFailed: (message: string) => void;
  /** Runs before the file is read, so a stale message can be dropped. */
  onStarted?: () => void;
};

/**
 * The button and hidden input that add a board file to the library. The picker
 * is cleared after every choice, so choosing the same file twice imports it
 * twice instead of looking like a no-op.
 */
export const BoardFileImport = ({
  buttonTestId,
  inputTestId,
  onImported,
  onFailed,
  onStarted,
}: Props) => {
  const input = useRef<HTMLInputElement>(null);

  const choose = useCallback(() => {
    input.current?.click();
  }, []);

  const pick = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (file === undefined) {
        return;
      }
      onStarted?.();
      try {
        onImported(await importBoardFile(file));
      } catch (thrown) {
        onFailed(messageOf(thrown));
      }
    },
    [onFailed, onImported, onStarted]
  );

  return (
    <>
      <Button
        data-testid={buttonTestId}
        onClick={choose}
        size='sm'
        variant='ghost'
      >
        Import file
      </Button>
      <input
        accept='.kyr.json,application/json'
        className='hidden'
        data-testid={inputTestId}
        onChange={pick}
        ref={input}
        type='file'
      />
    </>
  );
};
