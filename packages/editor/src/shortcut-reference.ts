import { type Command, commandId } from './commands';
import { type Binding, KEYMAP, rulesFor, SHORTCUT_ROWS } from './keymap';

/** One line the dialog shows: its copy, and the keys the keymap runs it with. */
export type ReferenceRow = {
  group: string;
  keys: readonly string[];
  label: string;
};

/** How a key reads in the reference: the named keys as themselves, the rest as typed. */
const KEY_NAMES: Readonly<Record<string, string>> = {
  arrowdown: '↓',
  arrowleft: '←',
  arrowright: '→',
  arrowup: '↑',
  escape: 'Esc',
  pagedown: 'PgDn',
  pageup: 'PgUp',
  space: 'Space',
};

/** The binding `command` is declared as, or `null` when nothing declares it. */
const bindingFor = (command: Command): Binding | null =>
  KEYMAP.find((binding) => commandId(binding.command) === commandId(command)) ??
  null;

/** Every binding `command` is declared as, in keymap order, so a key with aliases shows them all. */
const bindingsFor = (command: Command): Binding[] =>
  KEYMAP.filter((binding) => commandId(binding.command) === commandId(command));

/** The key `command` is bound to, or `null` when no binding declares it. */
export const bindingKey = (command: Command): string | null =>
  bindingFor(command)?.key ?? null;

/**
 * How a binding reads in the reference: the modifiers it requires, then its key,
 * so a binding that differs by a modifier shows that modifier rather than a row
 * of its own.
 */
export const bindingLabel = (binding: Binding): string => {
  const rules = rulesFor(binding);
  const parts: string[] = [];

  if (rules.command === 'required') {
    parts.push('Ctrl');
  }
  if (rules.alt === 'required') {
    parts.push('Alt');
  }
  if (rules.shift === 'required') {
    parts.push('Shift');
  }
  parts.push(KEY_NAMES[binding.key] ?? binding.key.toUpperCase());

  return parts.join(' + ');
};

/**
 * The shortcut reference, generated from the keymap: every row of copy, each
 * carrying the keys its commands are bound to.
 */
export const shortcutReference = (): ReferenceRow[] => {
  const rows: ReferenceRow[] = [];

  for (const row of SHORTCUT_ROWS) {
    const keys = row.commands.flatMap((command) =>
      bindingsFor(command).map((binding) => bindingLabel(binding))
    );

    if (keys.length > 0) {
      rows.push({ group: row.group, keys, label: row.label });
    }
  }

  return rows;
};
