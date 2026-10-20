import type { Command } from './commands';
import type { Binding, ShortcutRow } from './keymap';

/**
 * The presenting keys, declared in the same shape as the editing keymap and
 * folded into it. They live in their own module only so the keymap file stays
 * inside the size budget; there is still one keymap, one handler and one
 * reference, and presenting installs no second listener.
 */
export const PRESENT_BINDINGS: readonly Binding[] = [
  { command: { kind: 'present' }, key: 'p' },
  {
    command: { kind: 'present-next' },
    key: 'arrowright',
    mode: 'present',
  },
  { command: { kind: 'present-next' }, key: 'arrowdown', mode: 'present' },
  { command: { kind: 'present-next' }, key: 'space', mode: 'present' },
  { command: { kind: 'present-next' }, key: 'pagedown', mode: 'present' },
  {
    command: { kind: 'present-previous' },
    key: 'arrowleft',
    mode: 'present',
  },
  { command: { kind: 'present-previous' }, key: 'arrowup', mode: 'present' },
  { command: { kind: 'present-previous' }, key: 'pageup', mode: 'present' },
  { command: { kind: 'present-exit' }, key: 'escape', mode: 'present' },
  { command: { kind: 'present-notes' }, key: 'n', mode: 'present' },
  { command: { kind: 'present-timer' }, key: 't', mode: 'present' },
];

/** One presenting command, for a row that names it. */
const row = (command: Command, label: string): ShortcutRow => ({
  commands: [command],
  group: 'Presenting',
  label,
});

/** The reference rows for the presenting keys, whose keys the keymap supplies. */
export const PRESENT_ROWS: readonly ShortcutRow[] = [
  row({ kind: 'present' }, 'Present'),
  row({ kind: 'present-next' }, 'Next slide'),
  row({ kind: 'present-previous' }, 'Previous slide'),
  row({ kind: 'present-notes' }, 'Toggle notes'),
  row({ kind: 'present-timer' }, 'Toggle timer'),
  row({ kind: 'present-exit' }, 'Leave presenting'),
];
