'use client';

import type { LibraryEntry } from '@kiyora/editor';
import { useBoard, useEditor, useView } from '@kiyora/editor/react';
import { boardBounds, fitImageSize } from '@kiyora/model';
import {
  type ChangeEvent,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';
import { BoardFileImport } from '~/components/board-file-import';
import { Button } from '~/components/ui/button';
import { saveBoardFile } from '~/lib/board-file';
import { saveBoardSvg } from '~/lib/board-svg';
import { IMAGE_PLACEMENT_SIDE, importImage } from '~/lib/image-import';
import { createTextMeasurer } from '~/lib/text-measurer';
import { useCopyPng } from './copy-png-context';
import { ExportPngPanel } from './export-png-panel';

const messageOf = (thrown: unknown): string =>
  thrown instanceof Error ? thrown.message : String(thrown);

/**
 * The board as a file: save the open board, import one into the library beside
 * it, or take this board out as an SVG or a PNG. A refused file names what was
 * wrong and leaves the open board exactly where it was; a refused export names
 * why it could not be written.
 */
export const FileControls = () => {
  const editor = useEditor();
  const board = useBoard();
  const { camera } = useView();
  const imageInput = useRef<HTMLInputElement>(null);
  const measure = useMemo(() => createTextMeasurer(), []);
  const { clearError, error: copyError } = useCopyPng();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const shownError = error ?? copyError;
  const [png, setPng] = useState(false);

  const report = useCallback(
    (message: string | null) => {
      setError(message);
      if (message === null) {
        clearError();
      }
    },
    [clearError]
  );

  const importFailed = useCallback(
    (message: string) => {
      setNotice(null);
      report(message);
    },
    [report]
  );

  const importStarted = useCallback(() => {
    setNotice(null);
    report(null);
  }, [report]);

  const importImported = useCallback(
    (entry: LibraryEntry) => {
      setNotice(`Imported “${entry.title || 'Untitled'}” to the library`);
      report(null);
    },
    [report]
  );

  const chooseImage = useCallback(() => {
    imageInput.current?.click();
  }, []);

  const save = useCallback(() => {
    saveBoardFile({ ...board, camera });
  }, [board, camera]);

  const exportSvg = useCallback(() => {
    const run = async (): Promise<void> => {
      try {
        await saveBoardSvg(board, {
          measure,
          theme: board.settings.theme,
        });
        report(null);
      } catch (thrown) {
        report(messageOf(thrown));
      }
    };
    run().catch(() => undefined);
  }, [board, measure, report]);

  const togglePng = useCallback(() => {
    setPng((open) => !open);
  }, []);

  const place = useCallback(
    async (file: File) => {
      try {
        const imported = await importImage(file);
        const size = fitImageSize(
          { height: imported.height, width: imported.width },
          IMAGE_PLACEMENT_SIDE
        );
        const bounds = boardBounds(board);
        const box =
          bounds === null
            ? {
                h: size.height,
                w: size.width,
                x: -size.width / 2,
                y: -size.height / 2,
              }
            : {
                h: size.height,
                w: size.width,
                x: bounds.x + (bounds.w - size.width) / 2,
                y: bounds.y + bounds.h + 48,
              };
        editor.placeImage({
          box,
          file: imported.file,
          fileId: imported.fileId,
        });
        report(null);
      } catch (thrown) {
        report(messageOf(thrown));
      }
    },
    [board, editor, report]
  );

  const pickImage = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (file !== undefined) {
        await place(file);
      }
    },
    [place]
  );

  return (
    <div className='absolute top-3 right-3 z-10 flex max-w-xs flex-col items-end gap-1'>
      <div className='flex items-center gap-0.5 rounded-lg border border-border bg-background/90 p-1 shadow-sm backdrop-blur'>
        <BoardFileImport
          buttonTestId='import-file'
          inputTestId='file-input'
          onFailed={importFailed}
          onImported={importImported}
          onStarted={importStarted}
        />
        <Button
          data-testid='save-file'
          onClick={save}
          size='sm'
          variant='ghost'
        >
          Save file
        </Button>
        <Button
          data-testid='place-image'
          onClick={chooseImage}
          size='sm'
          variant='ghost'
        >
          Image
        </Button>
        <Button
          data-testid='export-svg'
          onClick={exportSvg}
          size='sm'
          variant='ghost'
        >
          Export SVG
        </Button>
        <Button
          aria-expanded={png}
          data-testid='png-options'
          onClick={togglePng}
          size='sm'
          variant='ghost'
        >
          Export PNG
        </Button>
      </div>
      {png ? <ExportPngPanel onError={report} /> : null}
      <input
        accept='image/png,image/jpeg'
        className='hidden'
        data-testid='image-input'
        onChange={pickImage}
        ref={imageInput}
        type='file'
      />
      {notice === null ? null : (
        <p
          className='rounded-lg border border-border bg-background/95 px-2 py-1 text-xs shadow-sm'
          data-testid='import-notice'
          role='status'
        >
          {notice}
        </p>
      )}
      {shownError === null ? null : (
        <p
          className='whitespace-pre-line rounded-lg border border-destructive/40 bg-background/95 px-2 py-1 text-destructive text-xs shadow-sm'
          data-testid='file-error'
          role='alert'
        >
          {shownError}
        </p>
      )}
    </div>
  );
};
