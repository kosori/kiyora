import type { Tool } from './tools';

/** A command a key runs. */
export type Command = { kind: 'tool'; tool: Tool } | { kind: 'show-shortcuts' };

/** A stable name for a command, so the keymap and the reference can join. */
export const commandId = (command: Command): string =>
  command.kind === 'tool' ? `tool.${command.tool}` : command.kind;

/** One binding: the key, and the command it runs. */
export type Binding = {
  command: Command;
  key: string;
};

/**
 * Every binding, in one place. A binding is a key and the command it runs;
 * nothing else declares one, so the dialog and the handler cannot disagree
 * about what a key does.
 */
export const KEYMAP: readonly Binding[] = [
  { command: { kind: 'tool', tool: 'select' }, key: 'v' },
  { command: { kind: 'tool', tool: 'rectangle' }, key: 'r' },
  { command: { kind: 'show-shortcuts' }, key: '?' },
];

/** One line of the reference: the copy, and the command it names. */
export type ShortcutRow = {
  command: Command;
  group: string;
  label: string;
};

/**
 * The reference's copy, in reading order. The keys are not repeated here: the
 * generator reads each one from the keymap, so the sheet shows what the app
 * runs or it shows nothing.
 */
export const SHORTCUT_ROWS: readonly ShortcutRow[] = [
  {
    command: { kind: 'tool', tool: 'select' },
    group: 'Tools',
    label: 'Select',
  },
  {
    command: { kind: 'tool', tool: 'rectangle' },
    group: 'Tools',
    label: 'Rectangle',
  },
  {
    command: { kind: 'show-shortcuts' },
    group: 'Help',
    label: 'Keyboard shortcuts',
  },
];

/** One line the dialog shows: its copy, and the key the keymap runs it with. */
export type ReferenceRow = {
  group: string;
  key: string;
  label: string;
};

/** The key `command` is bound to, or `null` when no binding declares it. */
export const bindingKey = (command: Command): string | null =>
  KEYMAP.find((binding) => commandId(binding.command) === commandId(command))
    ?.key ?? null;

/**
 * The shortcut reference, generated from the keymap: every row of copy, each
 * carrying the key its binding declares.
 */
export const shortcutReference = (): ReferenceRow[] => {
  const rows: ReferenceRow[] = [];

  for (const row of SHORTCUT_ROWS) {
    const key = bindingKey(row.command);
    if (key !== null) {
      rows.push({ group: row.group, key, label: row.label });
    }
  }

  return rows;
};

/** The command `key` runs, case-insensitively, or `null` when nothing is bound. */
export const resolveKey = (key: string): Command | null => {
  const normalised = key.toLowerCase();
  return KEYMAP.find((binding) => binding.key === normalised)?.command ?? null;
};
