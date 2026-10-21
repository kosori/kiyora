'use client';

import { restoreBoard } from '@kiyora/editor';
import {
  useBoard,
  useEditor,
  useSelection,
  useView,
} from '@kiyora/editor/react';
import type { Theme } from '@kiyora/model';
import {
  type ChangeEvent,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Button } from '~/components/ui/button';
import { openBoardFile, saveBoardFile } from '~/lib/board-file';
import {
  copySelectionPng,
  exportBoardPng,
  type PngBackground,
  type PngScale,
  type PngTarget,
  pngBoard,
  saveBoardPng,
} from '~/lib/board-png';
import { saveBoardSvg } from '~/lib/board-svg';
import { createTextMeasurer } from '~/lib/text-measurer';
import { OptionButtons } from './option-buttons';

type Option<T extends string> = { label: string; value: T };

const TARGET_OPTIONS: readonly Option<PngTarget>[] = [
  { label: 'Board', value: 'board' },
  { label: 'Selection', value: 'selection' },
];

const BOARD_OPTION: readonly Option<PngTarget>[] = [
  { label: 'Board', value: 'board' },
];

const SCALE_OPTIONS: readonly Option<'1' | '2' | '4'>[] = [
  { label: '1×', value: '1' },
  { label: '2×', value: '2' },
  { label: '4×', value: '4' },
];

const BACKGROUND_OPTIONS: readonly Option<PngBackground>[] = [
  { label: 'Transparent', value: 'transparent' },
  { label: 'Solid', value: 'solid' },
];

const THEME_OPTIONS: readonly Option<Theme>[] = [
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
];

/**
 * The board as a file: save the open board, open one in its place, or take it
 * out as an SVG or a PNG. A refused file names what was wrong and leaves the
 * open board exactly where it was; a refused export names why it could not be
 * written.
 *
 * The PNG panel is where the artifact's size, background and theme are chosen.
 * The theme is the export's own, not the app's, so a light canvas can leave as a
 * dark image.
 */
export const FileControls = () => {
  const editor = useEditor();
  const board = useBoard();
  const selection = useSelection();
  const { camera } = useView();
  const input = useRef<HTMLInputElement>(null);
  const measure = useMemo(() => createTextMeasurer(), []);
  const [error, setError] = useState<string | null>(null);
  const [png, setPng] = useState(false);
  const [target, setTarget] = useState<PngTarget>('board');
  const [scale, setScale] = useState<'1' | '2' | '4'>('2');
  const [background, setBackground] = useState<PngBackground>('transparent');
  const [theme, setTheme] = useState<Theme>('light');
  const targetOptions = selection.length === 0 ? BOARD_OPTION : TARGET_OPTIONS;
  const shownTarget: PngTarget = selection.length === 0 ? 'board' : target;

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

  const exportPng = useCallback(async () => {
    try {
      const blob = await exportBoardPng(
        pngBoard(board, selection, target),
        { background, scale: Number(scale) as PngScale, theme },
        measure
      );
      saveBoardPng(blob, board.title);
      setError(null);
    } catch (thrown) {
      setError(thrown instanceof Error ? thrown.message : String(thrown));
    }
  }, [background, board, measure, scale, selection, target, theme]);

  const copyPng = useCallback(async () => {
    if (selection.length === 0) {
      return;
    }
    try {
      await copySelectionPng(board, selection, measure);
      setError(null);
    } catch (thrown) {
      setError(thrown instanceof Error ? thrown.message : String(thrown));
    }
  }, [board, measure, selection]);

  const togglePng = useCallback(() => {
    setPng((open) => !open);
  }, []);

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
      {png ? (
        <div
          className='flex w-60 flex-col gap-2 rounded-lg border border-border bg-background/95 p-2 shadow-sm backdrop-blur'
          data-testid='png-panel'
        >
          <OptionButtons
            label='Target'
            onPick={setTarget}
            options={targetOptions}
            selected={shownTarget}
            testId='png-target'
          />
          <OptionButtons
            label='Scale'
            onPick={setScale}
            options={SCALE_OPTIONS}
            selected={scale}
            testId='png-scale'
          />
          <OptionButtons
            label='Background'
            onPick={setBackground}
            options={BACKGROUND_OPTIONS}
            selected={background}
            testId='png-background'
          />
          <OptionButtons
            label='Theme'
            onPick={setTheme}
            options={THEME_OPTIONS}
            selected={theme}
            testId='png-theme'
          />
          <Button data-testid='download-png' onClick={exportPng} size='sm'>
            Download PNG
          </Button>
          <Button
            data-testid='copy-png'
            disabled={selection.length === 0}
            onClick={copyPng}
            size='sm'
            variant='secondary'
          >
            Copy PNG
          </Button>
        </div>
      ) : null}
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
