import { type Command, commandId } from './commands';
import { type Binding, KEYMAP, rulesFor, SHORTCUT_ROWS } from './keymap';

/** One line the dialog shows: its copy, and the keys the keymap runs it with. */
export type ReferenceRow = {
  group: string;
  keys: readonly string[];
  label: string;
};

/**
 * The keyboard whose command key the copy names. The editor has no DOM, so it
 * cannot read the platform: the app decides and passes it, and nothing here
 * sniffs a user agent.
 */
export type Platform = 'macos' | 'other';

/** How the command key reads on `platform`: the sheet's symbol, and the name `aria-keyshortcuts` takes. */
export const commandKeyFor = (
  platform: Platform
): { aria: string; label: string } =>
  platform === 'macos'
    ? { aria: 'Meta', label: '⌘' }
    : { aria: 'Control', label: 'Ctrl' };

/** How a key reads in the reference: the named keys as themselves, the rest as typed. */
const KEY_NAMES: Readonly<Record<string, string>> = {
  arrowdown: '↓',
  arrowleft: '←',
  arrowright: '→',
  arrowup: '↑',
  enter: 'Enter',
  escape: 'Esc',
  pagedown: 'PgDn',
  pageup: 'PgUp',
  space: 'Space',
};

/** How a key reads in `aria-keyshortcuts`: DOM key names, not the glyphs the sheet shows. */
const ARIA_KEY_NAMES: Readonly<Record<string, string>> = {
  arrowdown: 'ArrowDown',
  arrowleft: 'ArrowLeft',
  arrowright: 'ArrowRight',
  arrowup: 'ArrowUp',
  backspace: 'Backspace',
  delete: 'Delete',
  escape: 'Escape',
  pagedown: 'PageDown',
  pageup: 'PageUp',
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
export const bindingLabel = (binding: Binding, platform: Platform): string => {
  const rules = rulesFor(binding);
  const parts: string[] = [];

  if (rules.command === 'required') {
    parts.push(commandKeyFor(platform).label);
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

/** The `aria-keyshortcuts` value for `binding`, read from the modifiers it requires. */
const bindingShortcut = (binding: Binding, platform: Platform): string => {
  const rules = rulesFor(binding);
  const parts: string[] = [];

  if (rules.command === 'required') {
    parts.push(commandKeyFor(platform).aria);
  }
  if (rules.alt === 'required') {
    parts.push('Alt');
  }
  if (rules.shift === 'required') {
    parts.push('Shift');
  }
  const key = ARIA_KEY_NAMES[binding.key] ?? binding.key;
  parts.push(
    key.length === 1 && rules.shift === 'required' ? key.toUpperCase() : key
  );

  return parts.join('+');
};

/**
 * The `aria-keyshortcuts` value for `command`, or `undefined` when no binding
 * declares it. A command with several bindings lists them all, so a control
 * cannot advertise one chord while the keymap answers another.
 */
export const keyshortcutsFor = (
  command: Command,
  platform: Platform
): string | undefined => {
  const shortcuts = bindingsFor(command).map((binding) =>
    bindingShortcut(binding, platform)
  );

  return shortcuts.length === 0 ? undefined : shortcuts.join(' ');
};

/** One palette row: a reference row plus the commands choosing it runs. */
export type PaletteEntry = ReferenceRow & {
  /** The commands the row names; a row with variants runs its first. */
  commands: readonly Command[];
};

/**
 * The rows both views show, with the keys read from the keymap. The reference
 * and the palette are generated from this one list, so neither can show a label
 * or a key the other lacks.
 */
const shownRows = (platform: Platform): PaletteEntry[] =>
  SHORTCUT_ROWS.flatMap((row) => {
    const keys = row.commands.flatMap((command) =>
      bindingsFor(command).map((binding) => bindingLabel(binding, platform))
    );

    return keys.length === 0
      ? []
      : [{ commands: row.commands, group: row.group, keys, label: row.label }];
  });

/**
 * The shortcut reference, generated from the keymap: every row of copy, each
 * carrying the keys its commands are bound to.
 */
export const shortcutReference = (platform: Platform): ReferenceRow[] =>
  shownRows(platform).map(({ group, keys, label }) => ({ group, keys, label }));

/**
 * The commands the palette offers, in the reference's order and under its
 * labels, so the palette lists exactly what the keymap binds.
 */
export const commandPalette = (platform: Platform): PaletteEntry[] =>
  shownRows(platform);
