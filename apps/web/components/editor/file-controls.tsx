'use client';

import { restoreBoard } from '@kiyora/editor';
import { useBoard, useEditor, useView } from '@kiyora/editor/react';
import {
  type ChangeEvent,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Button } from '~/components/ui/button';
import { openBoardFile, saveBoardFile } from '~/lib/board-file';
import { saveBoardSvg } from '~/lib/board-svg';
import { createTextMeasurer } from '~/lib/text-measurer';

/**
 * The board as a file: save the open board, open one in its place, or take it
 * out as an SVG. A refused file names what was wrong and leaves the open board
 * exactly where it was; a refused export names why it could not be written.
 */
export const FileControls = () => {
  const editor = useEditor();
  const board = useBoard();
  const { camera } = useView();
  const input = useRef<HTMLInputElement>(null);
  const measure = useMemo(() => createTextMeasurer(), []);
  const [error, setError] = useState<string | null>(null);

  const open = useCallback(
    async (file: File): Promise<void> => {
      try {
        restoreBoard(editor, await openBoardFile(file));
        setError(null);
      } catch (thrown) {
        setError(thrown instanceof Error ? thrown.message : String(thrown));
      }
    },
    [editor]
  );

  const choose = useCallback(() => {
    input.current?.click();
  }, []);

  const save = useCallback(() => {
    saveBoardFile({ ...board, camera });
  }, [board, camera]);

  const exportSvg = useCallback(() => {
    try {
      saveBoardSvg(board, { measure, theme: board.settings.theme });
      setError(null);
    } catch (thrown) {
      setError(thrown instanceof Error ? thrown.message : String(thrown));
    }
  }, [board, measure]);

  const pick = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (file !== undefined) {
        await open(file);
      }
    },
    [open]
  );

  return (
    <div className='absolute top-3 right-3 z-10 flex max-w-xs flex-col items-end gap-1'>
      <div className='flex items-center gap-0.5 rounded-lg border border-border bg-background/90 p-1 shadow-sm backdrop-blur'>
        <Button
          data-testid='open-file'
          onClick={choose}
          size='sm'
          variant='ghost'
        >
          Open file
        </Button>
        <Button
          data-testid='save-file'
          onClick={save}
          size='sm'
          variant='ghost'
        >
          Save file
        </Button>
        <Button
          data-testid='export-svg'
          onClick={exportSvg}
          size='sm'
          variant='ghost'
        >
          Export SVG
        </Button>
      </div>
      <input
        accept='.kyr.json,application/json'
        className='hidden'
        data-testid='file-input'
        onChange={pick}
        ref={input}
        type='file'
      />
      {error === null ? null : (
        <p
          className='whitespace-pre-line rounded-lg border border-destructive/40 bg-background/95 px-2 py-1 text-destructive text-xs shadow-sm'
          data-testid='file-error'
          role='alert'
        >
          {error}
        </p>
      )}
    </div>
  );
};
