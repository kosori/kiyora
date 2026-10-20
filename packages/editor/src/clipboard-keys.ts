import type { Command } from './commands';
import type { Binding, ShortcutRow } from './keymap';

/**
 * The clipboard keys, declared in the same shape as the editing keymap and
 * folded into it. They live in their own module only so the keymap file stays
 * inside the size budget; there is still one keymap, one handler and one
 * reference, so the dialog cannot teach a shortcut the app does not run.
 */
export const CLIPBOARD_BINDINGS: readonly Binding[] = [
  {
    command: { kind: 'duplicate' },
    key: 'd',
    modifiers: { command: 'required' },
    preventDefault: true,
  },
  {
    command: { kind: 'copy' },
    key: 'c',
    modifiers: { command: 'required' },
    preventDefault: true,
  },
  {
    command: { kind: 'cut' },
    key: 'x',
    modifiers: { command: 'required' },
    preventDefault: true,
  },
  {
    command: { kind: 'paste' },
    key: 'v',
    modifiers: { command: 'required' },
    preventDefault: true,
  },
];

/** One clipboard command, for a row that names it. */
const row = (command: Command, label: string): ShortcutRow => ({
  commands: [command],
  group: 'Clipboard',
  label,
});

/** The reference rows for the clipboard keys, whose keys the keymap supplies. */
export const CLIPBOARD_ROWS: readonly ShortcutRow[] = [
  row({ kind: 'duplicate' }, 'Duplicate'),
  row({ kind: 'copy' }, 'Copy'),
  row({ kind: 'cut' }, 'Cut'),
  row({ kind: 'paste' }, 'Paste'),
];
