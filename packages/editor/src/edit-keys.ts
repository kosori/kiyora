import type { Command } from './commands';
import type { Binding, ShortcutRow } from './keymap';

/** The four arrows and the delta each moves by, so a key and its meaning sit together. */
const ARROWS: readonly { dx: number; dy: number; key: string }[] = [
  { dx: 0, dy: -1, key: 'arrowup' },
  { dx: 0, dy: 1, key: 'arrowdown' },
  { dx: -1, dy: 0, key: 'arrowleft' },
  { dx: 1, dy: 0, key: 'arrowright' },
];

/** One arrow binding: `coarse` asks for a grid step, which the shift key requires. */
const nudgeBinding = (
  { dx, dy, key }: (typeof ARROWS)[number],
  coarse: boolean
): Binding => ({
  command: { coarse, dx, dy, kind: 'nudge' },
  key,
  modifiers: { shift: coarse ? 'required' : 'forbidden' },
});

/**
 * The editing keys, declared in the same shape as the rest of the keymap and
 * folded into it. They live in their own module only so the keymap file stays
 * inside the size budget; there is still one keymap, one handler and one
 * reference, so the dialog cannot teach a shortcut the app does not run.
 */
export const EDIT_BINDINGS: readonly Binding[] = [
  { command: { kind: 'tool', tool: 'select' }, key: 'v' },
  { command: { kind: 'tool', tool: 'rectangle' }, key: 'r' },
  { command: { kind: 'tool', tool: 'text' }, key: 't' },
  { command: { kind: 'tool', tool: 'connector' }, key: 'c' },
  { command: { kind: 'tool', tool: 'sticky' }, key: 's' },
  { command: { kind: 'tool', tool: 'frame' }, key: 'f' },
  { command: { action: 'pan', kind: 'camera' }, key: 'space' },
  { command: { action: 'zoom-in', kind: 'camera' }, key: '=' },
  { command: { action: 'zoom-out', kind: 'camera' }, key: '-' },
  { command: { kind: 'show-shortcuts' }, key: '?' },
  { command: { kind: 'cancel-gesture' }, key: 'escape' },
  { command: { kind: 'delete' }, key: 'delete' },
  { command: { kind: 'delete' }, key: 'backspace' },
  {
    command: { kind: 'undo' },
    key: 'z',
    modifiers: { command: 'required', shift: 'forbidden' },
  },
  {
    command: { kind: 'redo' },
    key: 'z',
    modifiers: { command: 'required', shift: 'required' },
  },
  ...ARROWS.map((arrow) => nudgeBinding(arrow, false)),
  ...ARROWS.map((arrow) => nudgeBinding(arrow, true)),
];

/** One row of the reference, in the group its copy belongs to. */
const row = (command: Command, group: string, label: string): ShortcutRow => ({
  commands: [command],
  group,
  label,
});

/** The nudge commands the edit keymap declares at one granularity, so the sheet follows it. */
const nudgeCommands = (coarse: boolean): Command[] =>
  EDIT_BINDINGS.flatMap((binding) =>
    binding.command.kind === 'nudge' && binding.command.coarse === coarse
      ? [binding.command]
      : []
  );

/** The reference rows for the editing keys, whose keys the keymap supplies. */
export const EDIT_ROWS: readonly ShortcutRow[] = [
  row({ kind: 'tool', tool: 'select' }, 'Tools', 'Select'),
  row({ kind: 'tool', tool: 'rectangle' }, 'Tools', 'Rectangle'),
  row({ kind: 'tool', tool: 'text' }, 'Tools', 'Text'),
  row({ kind: 'tool', tool: 'connector' }, 'Tools', 'Connector'),
  row({ kind: 'delete' }, 'Selection', 'Delete'),
  row({ kind: 'tool', tool: 'sticky' }, 'Tools', 'Sticky'),
  row({ kind: 'tool', tool: 'frame' }, 'Tools', 'Frame'),
  row({ action: 'pan', kind: 'camera' }, 'View', 'Pan (hold)'),
  row({ action: 'zoom-in', kind: 'camera' }, 'View', 'Zoom in'),
  row({ action: 'zoom-out', kind: 'camera' }, 'View', 'Zoom out'),
  {
    commands: nudgeCommands(false),
    group: 'Selection',
    label: 'Nudge by a pixel',
  },
  {
    commands: nudgeCommands(true),
    group: 'Selection',
    label: 'Nudge by a grid step',
  },
  row({ kind: 'cancel-gesture' }, 'Selection', 'Cancel a gesture'),
];

/** The rows after the clipboard's in the reference: the history and the help. */
export const HISTORY_ROWS: readonly ShortcutRow[] = [
  row({ kind: 'undo' }, 'History', 'Undo'),
  row({ kind: 'redo' }, 'History', 'Redo'),
  row({ kind: 'show-shortcuts' }, 'Help', 'Keyboard shortcuts'),
];
