'use client';

import { keyshortcutsFor, runCommand, type Tool } from '@kiyora/editor';
import { useBoard, useEditor, useSelection } from '@kiyora/editor/react';
import { boardBounds, fitImageSize, IMAGE_PLACEMENT_SIDE } from '@kiyora/model';
import {
  IconArrowUpRight,
  IconChartBar,
  IconCircle,
  IconFrame,
  IconHandMove,
  IconLock,
  IconNote,
  IconPencil,
  IconPhoto,
  IconPointer,
  IconRectangle,
  IconTable,
  IconTypography,
  type TablerIcon,
} from '@tabler/icons-react';
import { cn } from 'cn';
import { type ChangeEvent, type ReactNode, useCallback, useRef } from 'react';
import { Button } from '~/components/ui/button';
import { importImage } from '~/lib/image-import';
import { IconPicker } from './icon-picker';
import { RailMore } from './rail-more';
import { ShapePicker } from './shape-picker';
import { ToolRailButton } from './tool-rail-button';
import { usePlatform } from './use-platform';

/**
 * One row of the rail. The rail is a list so a tool added later is one entry,
 * and the rest of the vocabulary arrives without reshaping it.
 */
export type RailEntry = {
  icon: TablerIcon;
  label: string;
  tool: Tool;
};

/** The tools the rail offers. The pickers carry the rest of the vocabulary. */
const RAIL: readonly RailEntry[] = [
  { icon: IconPointer, label: 'Select', tool: 'select' },
  { icon: IconHandMove, label: 'Hand', tool: 'hand' },
  { icon: IconRectangle, label: 'Rectangle', tool: 'rectangle' },
  { icon: IconCircle, label: 'Ellipse', tool: 'ellipse' },
  { icon: IconArrowUpRight, label: 'Connector', tool: 'connector' },
  { icon: IconTypography, label: 'Text', tool: 'text' },
  { icon: IconPencil, label: 'Ink', tool: 'ink' },
  { icon: IconNote, label: 'Sticky', tool: 'sticky' },
  { icon: IconFrame, label: 'Frame', tool: 'frame' },
  { icon: IconTable, label: 'Table', tool: 'data-table' },
  { icon: IconChartBar, label: 'Chart', tool: 'chart' },
];

const RAIL_BUTTON =
  'chrome-icon chrome-fg [&_svg]:size-[18px] [&_svg]:[stroke-width:1.75]';

const PICKER_BUTTON =
  '[&>div>button]:size-8 [&>div>button]:rounded-[8px] [&>div>button]:text-[var(--chrome-fg)] [&>div>button>svg]:size-[18px] [&>div>button>svg]:[stroke-width:1.75] [&>div>button[aria-pressed=false]]:bg-transparent [&>div>button[aria-pressed=false]]:hover:bg-[var(--chrome-hover)] [&>div>button[aria-pressed=true]]:bg-[var(--chrome-active)] [&>div>button[aria-pressed=true]]:hover:bg-[var(--chrome-active)]';

/** The rail entry for a tool, so the card can place groups without a second list. */
const byTool = (tool: Tool): RailEntry => {
  const entry = RAIL.find((one) => one.tool === tool);
  if (entry === undefined) {
    throw new Error(`the rail has no entry for ${tool}`);
  }
  return entry;
};

/** A hairline between two groups of rail tools. */
const Divider = () => (
  <span aria-hidden='true' className='my-1 h-px w-6 bg-border' />
);

/** The small grey triangle a rail entry wears when it opens a submenu. */
const Caret = () => (
  <span
    aria-hidden='true'
    className='pointer-events-none absolute right-[3px] bottom-[3px] h-0 w-0 border-r-[4px] border-r-transparent border-b-[4px] border-b-[var(--chrome-muted)]'
  />
);

/** Wraps a picker's existing button in the rail's button surface and caret. */
const PickerShell = ({ children }: { children: ReactNode }) => (
  <div className={cn('relative', PICKER_BUTTON)}>
    {children}
    <Caret />
  </div>
);

/** The rail's image entry: it picks a raster and places it through the engine. */
const ImageButton = () => {
  const editor = useEditor();
  const board = useBoard();
  const input = useRef<HTMLInputElement>(null);

  const choose = useCallback(() => {
    input.current?.click();
  }, []);

  const place = useCallback(
    async (file: File) => {
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
              y: bounds.y + (bounds.h - size.height) / 2,
            };
      editor.placeImage({
        box,
        file: imported.file,
        fileId: imported.fileId,
      });
    },
    [board, editor]
  );

  const pick = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (file !== undefined) {
        place(file).catch(() => undefined);
      }
    },
    [place]
  );

  return (
    <>
      <Button
        aria-label='Image'
        className={cn(
          RAIL_BUTTON,
          'chrome-hover hover:bg-[var(--chrome-hover)]'
        )}
        data-testid='place-image-rail'
        onClick={choose}
        size='icon'
        title='Image'
        variant='ghost'
      >
        <IconPhoto />
      </Button>
      <input
        accept='image/png,image/jpeg'
        className='hidden'
        onChange={pick}
        ref={input}
        type='file'
      />
    </>
  );
};

/** The rail's lock entry: it locks or unlocks the selection, and rests disabled with none. */
const LockButton = () => {
  const editor = useEditor();
  const board = useBoard();
  const selection = useSelection();
  const platform = usePlatform();
  const selected = board.shapes.filter((shape) => selection.includes(shape.id));
  const disabled = selected.length === 0;
  const locked = selected.length > 0 && selected.every((shape) => shape.locked);

  const toggle = useCallback(() => {
    runCommand({ kind: 'lock' }, { editor });
  }, [editor]);

  return (
    <Button
      aria-keyshortcuts={keyshortcutsFor({ kind: 'lock' }, platform)}
      aria-label='Lock'
      aria-pressed={locked}
      className={cn(
        RAIL_BUTTON,
        locked
          ? 'hover:bg-[var(--chrome-active)]'
          : 'chrome-hover hover:bg-[var(--chrome-hover)]'
      )}
      data-testid='lock-rail'
      disabled={disabled}
      onClick={toggle}
      size='icon'
      style={locked ? { backgroundColor: 'var(--chrome-active)' } : undefined}
      title='Lock'
      variant='ghost'
    >
      <IconLock />
    </Button>
  );
};

/**
 * The tool rail: a navigation landmark around the floating card a person
 * chooses tools from. Every button names its tool, and the active one reads as
 * pressed.
 */
export const ToolRail = () => (
  <nav aria-label='Board tools'>
    <div
      aria-label='Tools'
      className='chrome-surface chrome-card flex w-10 flex-col items-center gap-0.5 p-1'
      data-testid='tools'
      role='toolbar'
    >
      <ToolRailButton entry={byTool('select')} />
      <ToolRailButton entry={byTool('hand')} />
      <Divider />
      <ToolRailButton entry={byTool('rectangle')} />
      <ToolRailButton entry={byTool('ellipse')} />
      <PickerShell>
        <ShapePicker />
      </PickerShell>
      <ToolRailButton entry={byTool('connector')} />
      <Divider />
      <ToolRailButton entry={byTool('text')} />
      <ToolRailButton entry={byTool('ink')} />
      <Divider />
      <ToolRailButton entry={byTool('sticky')} />
      <ToolRailButton entry={byTool('frame')} />
      <ImageButton />
      <PickerShell>
        <IconPicker />
      </PickerShell>
      <ToolRailButton entry={byTool('data-table')} />
      <ToolRailButton entry={byTool('chart')} />
      <RailMore />
      <Divider />
      <LockButton />
    </div>
  </nav>
);
