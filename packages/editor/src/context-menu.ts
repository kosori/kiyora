import type { Board } from '@kiyora/model';
import { arrangeableShapes } from './align';
import type { Command } from './commands';
import {
  type Selection,
  selectedLocked,
  selectedRoots,
  selectedShapes,
} from './selection';

/**
 * The context menu's structure: which commands it offers, in which order, and
 * which of them can act on the selection it opened over. The rules live here
 * rather than in the app so they are proven in Node and so the menu is data — a
 * surface renders it, and a new entry is one line.
 */

/** One entry: the command it runs, its copy, and whether it can run now. */
export type ContextMenuItem = {
  command: Command;
  disabled: boolean;
  label: string;
};

/** One titled group of entries, in reading order. */
export type ContextMenuSection = {
  items: readonly ContextMenuItem[];
  label: string;
};

/** What the menu reads to decide what is available: never a board write. */
export type ContextMenuState = {
  board: Board;
  /** Whether the clipboard holds a fragment, so paste has somewhere to go. */
  canPaste: boolean;
  selection: Selection;
};

/** The entries that need a selection, and the one that needs only a clipboard. */
export const contextMenu = ({
  board,
  canPaste,
  selection,
}: ContextMenuState): ContextMenuSection[] => {
  const hasSelection = selection.length > 0;
  const roots = selectedRoots(board, selection);
  const arrangeable = arrangeableShapes(board, selection);
  const canArrange =
    arrangeable.length >= 2 && arrangeable.some((shape) => !shape.locked);
  const hasGroup = selectedShapes(board, selection).some(
    (shape) => shape.kind === 'group'
  );
  const locked = selectedLocked(board, selection);

  const entry = (
    command: Command,
    label: string,
    disabled = false
  ): ContextMenuItem => ({ command, disabled, label });

  return [
    {
      items: [
        entry({ kind: 'cut' }, 'Cut', !hasSelection),
        entry({ kind: 'copy' }, 'Copy', !hasSelection),
        entry({ kind: 'duplicate' }, 'Duplicate', !hasSelection),
        entry({ kind: 'paste' }, 'Paste', !canPaste),
      ],
      label: 'Clipboard',
    },
    {
      items: [
        entry({ kind: 'group' }, 'Group', roots.length < 2),
        entry({ kind: 'ungroup' }, 'Ungroup', !hasGroup),
        entry({ kind: 'lock' }, locked ? 'Unlock' : 'Lock', !hasSelection),
        entry({ kind: 'delete' }, 'Delete', !hasSelection),
      ],
      label: 'Selection',
    },
    {
      items: [
        entry({ alignment: 'left', kind: 'align' }, 'Align left', !canArrange),
        entry(
          { alignment: 'center-horizontal', kind: 'align' },
          'Align centre horizontally',
          !canArrange
        ),
        entry(
          { alignment: 'right', kind: 'align' },
          'Align right',
          !canArrange
        ),
        entry({ alignment: 'top', kind: 'align' }, 'Align top', !canArrange),
        entry(
          { alignment: 'center-vertical', kind: 'align' },
          'Align centre vertically',
          !canArrange
        ),
        entry(
          { alignment: 'bottom', kind: 'align' },
          'Align bottom',
          !canArrange
        ),
      ],
      label: 'Align',
    },
    {
      items: [
        entry({ kind: 'bring-to-front' }, 'Bring to front', !hasSelection),
        entry({ kind: 'bring-forward' }, 'Bring forward', !hasSelection),
        entry({ kind: 'send-backward' }, 'Send backward', !hasSelection),
        entry({ kind: 'send-to-back' }, 'Send to back', !hasSelection),
      ],
      label: 'Order',
    },
  ];
};
