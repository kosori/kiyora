'use client';

import { keyshortcutsFor } from '@kiyora/editor';
import { useBoard, useSelection } from '@kiyora/editor/react';
import type { Theme } from '@kiyora/model';
import { useCallback, useMemo, useState } from 'react';
import { Button } from '~/components/ui/button';
import {
  exportBoardPng,
  type PngBackground,
  type PngScale,
  type PngTarget,
  pngBoard,
  saveBoardPng,
} from '~/lib/board-png';
import { createTextMeasurer } from '~/lib/text-measurer';
import { useCopyPng } from './copy-png-context';
import { OptionButtons } from './option-buttons';
import { usePlatform } from './use-platform';

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

const messageOf = (thrown: unknown): string =>
  thrown instanceof Error ? thrown.message : String(thrown);

type Props = {
  /** Names a refusal, or clears it once an export succeeds. */
  onError: (message: string | null) => void;
};

/**
 * The PNG export's size, background, theme and the two actions that leave with
 * an image. The theme starts at the board's own, so a dark board leaves dark
 * without a second choice, and it stays an override: the export's theme is its
 * own, so a dark board can still leave as a light image.
 */
export const ExportPngPanel = ({ onError }: Props) => {
  const board = useBoard();
  const selection = useSelection();
  const platform = usePlatform();
  const measure = useMemo(() => createTextMeasurer(), []);
  const { copy } = useCopyPng();
  const [target, setTarget] = useState<PngTarget>('board');
  const [scale, setScale] = useState<'1' | '2' | '4'>('2');
  const [background, setBackground] = useState<PngBackground>('transparent');
  const [theme, setTheme] = useState<Theme | null>(null);
  const exportTheme = theme ?? board.settings.theme;
  const targetOptions = selection.length === 0 ? BOARD_OPTION : TARGET_OPTIONS;
  const shownTarget: PngTarget = selection.length === 0 ? 'board' : target;

  const download = useCallback(async () => {
    try {
      const blob = await exportBoardPng(
        pngBoard(board, selection, target),
        { background, scale: Number(scale) as PngScale, theme: exportTheme },
        measure
      );
      saveBoardPng(blob, board.title);
      onError(null);
    } catch (thrown) {
      onError(messageOf(thrown));
    }
  }, [
    background,
    board,
    exportTheme,
    measure,
    onError,
    scale,
    selection,
    target,
  ]);

  return (
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
        selected={exportTheme}
        testId='png-theme'
      />
      <Button data-testid='download-png' onClick={download} size='sm'>
        Download PNG
      </Button>
      <Button
        aria-keyshortcuts={keyshortcutsFor({ kind: 'copy-png' }, platform)}
        data-testid='copy-png'
        disabled={selection.length === 0}
        onClick={copy}
        size='sm'
        variant='secondary'
      >
        Copy PNG
      </Button>
    </div>
  );
};
