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
  preventDefault: true,
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
  {
    command: { action: 'pan', kind: 'camera' },
    key: 'space',
    preventDefault: true,
  },
  {
    command: { action: 'zoom-in', kind: 'camera' },
    key: '=',
    preventDefault: true,
  },
  {
    command: { action: 'zoom-out', kind: 'camera' },
    key: '-',
    preventDefault: true,
  },
  {
    command: { kind: 'find' },
    key: 'f',
    modifiers: { command: 'required' },
    preventDefault: true,
  },
  { command: { kind: 'show-shortcuts' }, key: '?' },
  { command: { kind: 'cancel-gesture' }, key: 'escape' },
  { command: { kind: 'delete' }, key: 'delete', preventDefault: true },
  { command: { kind: 'delete' }, key: 'backspace', preventDefault: true },
  {
    command: { kind: 'group' },
    key: 'g',
    modifiers: { command: 'required', shift: 'forbidden' },
  },
  {
    command: { kind: 'ungroup' },
    key: 'g',
    modifiers: { command: 'required', shift: 'required' },
  },
  { command: { kind: 'lock' }, key: 'l' },
  {
    command: { kind: 'bring-forward' },
    key: ']',
    modifiers: { command: 'required', shift: 'forbidden' },
    preventDefault: true,
  },
  {
    command: { kind: 'send-backward' },
    key: '[',
    modifiers: { command: 'required', shift: 'forbidden' },
    preventDefault: true,
  },
  {
    command: { kind: 'bring-to-front' },
    key: ']',
    modifiers: { command: 'required', shift: 'required' },
    preventDefault: true,
  },
  {
    command: { kind: 'send-to-back' },
    key: '[',
    modifiers: { command: 'required', shift: 'required' },
    preventDefault: true,
  },
  {
    command: { alignment: 'left', kind: 'align' },
    key: 'a',
    modifiers: { alt: 'required' },
    preventDefault: true,
  },
  {
    command: { alignment: 'center-horizontal', kind: 'align' },
    key: 'h',
    modifiers: { alt: 'required', shift: 'forbidden' },
    preventDefault: true,
  },
  {
    command: { alignment: 'right', kind: 'align' },
    key: 'd',
    modifiers: { alt: 'required' },
    preventDefault: true,
  },
  {
    command: { alignment: 'top', kind: 'align' },
    key: 'w',
    modifiers: { alt: 'required' },
    preventDefault: true,
  },
  {
    command: { alignment: 'center-vertical', kind: 'align' },
    key: 'v',
    modifiers: { alt: 'required', shift: 'forbidden' },
    preventDefault: true,
  },
  {
    command: { alignment: 'bottom', kind: 'align' },
    key: 's',
    modifiers: { alt: 'required' },
    preventDefault: true,
  },
  {
    command: { axis: 'x', kind: 'distribute' },
    key: 'h',
    modifiers: { alt: 'required', shift: 'required' },
    preventDefault: true,
  },
  {
    command: { axis: 'y', kind: 'distribute' },
    key: 'v',
    modifiers: { alt: 'required', shift: 'required' },
    preventDefault: true,
  },
  {
    command: { kind: 'undo' },
    key: 'z',
    modifiers: { command: 'required', shift: 'forbidden' },
    preventDefault: true,
  },
  {
    command: { kind: 'redo' },
    key: 'z',
    modifiers: { command: 'required', shift: 'required' },
    preventDefault: true,
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
  row({ kind: 'find' }, 'View', 'Find on board'),
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
  row({ kind: 'group' }, 'Selection', 'Group'),
  row({ kind: 'ungroup' }, 'Selection', 'Ungroup'),
  row({ kind: 'lock' }, 'Selection', 'Lock or unlock'),
  row({ kind: 'bring-to-front' }, 'Arrange', 'Bring to front'),
  row({ kind: 'bring-forward' }, 'Arrange', 'Bring forward'),
  row({ kind: 'send-backward' }, 'Arrange', 'Send backward'),
  row({ kind: 'send-to-back' }, 'Arrange', 'Send to back'),
  row({ alignment: 'left', kind: 'align' }, 'Arrange', 'Align left'),
  row(
    { alignment: 'center-horizontal', kind: 'align' },
    'Arrange',
    'Align centre horizontally'
  ),
  row({ alignment: 'right', kind: 'align' }, 'Arrange', 'Align right'),
  row({ alignment: 'top', kind: 'align' }, 'Arrange', 'Align top'),
  row(
    { alignment: 'center-vertical', kind: 'align' },
    'Arrange',
    'Align centre vertically'
  ),
  row({ alignment: 'bottom', kind: 'align' }, 'Arrange', 'Align bottom'),
  row({ axis: 'x', kind: 'distribute' }, 'Arrange', 'Distribute horizontally'),
  row({ axis: 'y', kind: 'distribute' }, 'Arrange', 'Distribute vertically'),
];

/** The rows after the clipboard's in the reference: the history and the help. */
export const HISTORY_ROWS: readonly ShortcutRow[] = [
  row({ kind: 'undo' }, 'History', 'Undo'),
  row({ kind: 'redo' }, 'History', 'Redo'),
  row({ kind: 'show-shortcuts' }, 'Help', 'Keyboard shortcuts'),
];
