import { CLIPBOARD_BINDINGS, CLIPBOARD_ROWS } from './clipboard-keys';
import type { Command } from './commands';
import { EDIT_BINDINGS, EDIT_ROWS, HISTORY_ROWS } from './edit-keys';
import { PRESENT_BINDINGS, PRESENT_ROWS } from './present-keys';

/**
 * How a binding treats one modifier: it must be held, must not be held, or does
 * not care. Two bindings on the same key differ by setting this one way here and
 * the other way there, rather than by spelling the combination into the key.
 */
export type ModifierRule = 'required' | 'forbidden' | 'ignored';

/**
 * When a binding applies: while editing the board, or while presenting it. The
 * two share one keymap, so a key pressed while presenting cannot run an editing
 * command behind the slide, and the reference is generated from both.
 */
export const KEY_MODES = ['edit', 'present'] as const;

/** When a binding applies. */
export type KeyMode = (typeof KEY_MODES)[number];

/** The modifiers a binding constrains. An omitted one takes the default below. */
export type Modifiers = {
  alt?: ModifierRule;
  /** The platform command key: meta on macOS, control elsewhere. */
  command?: ModifierRule;
  shift?: ModifierRule;
};

/**
 * The rules a binding without an explicit one uses. Shift is ignored because it
 * is part of producing a character — `?` is a shifted key — while alt and the
 * platform command key are forbidden because they belong to the OS and browser.
 */
const DEFAULT_MODIFIERS: Required<Modifiers> = {
  alt: 'forbidden',
  command: 'forbidden',
  shift: 'ignored',
};

/** The rules `binding` resolves with, its own where it has one, the default elsewhere. */
export const rulesFor = (binding: Binding): Required<Modifiers> => ({
  alt: binding.modifiers?.alt ?? DEFAULT_MODIFIERS.alt,
  command: binding.modifiers?.command ?? DEFAULT_MODIFIERS.command,
  shift: binding.modifiers?.shift ?? DEFAULT_MODIFIERS.shift,
});

/** One binding: the key, the modifiers it constrains, and the command it runs. */
export type Binding = {
  command: Command;
  key: string;
  /** When the binding applies. Omitted means editing, so the edit keymap stays as it was. */
  mode?: KeyMode;
  modifiers?: Modifiers;
};

/**
 * Keys that mean a declared one: a shifted `+` zooms like `=`, and a shifted
 * `_` zooms like `-`, without a second binding that has to be kept in step.
 */
export const KEY_ALIASES: Readonly<Record<string, string>> = {
  _: '-',
  '+': '=',
};

/**
 * The keymap token for a keyboard event's `key`. Space is the one key whose
 * `key` is a character, so it gets a word; every other key is lowercased.
 */
export const keyToken = (key: string): string => {
  const lowered = key.toLowerCase();
  const token = lowered === ' ' || lowered === 'space' ? 'space' : lowered;

  return KEY_ALIASES[token] ?? token;
};

/**
 * Every binding, in one place. A binding is a key, the modifiers it requires or
 * forbids, and the command it runs; nothing else declares one, so the dialog and
 * the handler cannot disagree about what a key does. The three modes it folds
 * together each own a module, which is what keeps this file inside the budget.
 */
export const KEYMAP: readonly Binding[] = [
  ...EDIT_BINDINGS,
  ...CLIPBOARD_BINDINGS,
  ...PRESENT_BINDINGS,
];

/** One line of the reference: the copy, and the commands it names. */
export type ShortcutRow = {
  commands: readonly Command[];
  group: string;
  label: string;
};

/**
 * The reference's copy, in reading order. The keys are not repeated here: the
 * generator reads each one from the keymap, so the sheet shows what the app
 * runs or it shows nothing.
 */
export const SHORTCUT_ROWS: readonly ShortcutRow[] = [
  ...EDIT_ROWS,
  ...CLIPBOARD_ROWS,
  ...HISTORY_ROWS,
  ...PRESENT_ROWS,
];

/** A keyboard event as the keymap sees it: its key, and which modifiers are held. */
export type Chord = {
  alt?: boolean;
  /** The platform command key: meta on macOS, control elsewhere. */
  command?: boolean;
  key: string;
  /** When the key was pressed. Omitted means editing. */
  mode?: KeyMode;
  shift?: boolean;
};

/** Whether a modifier's rule is satisfied when the modifier is `held`. */
const holds = (rule: ModifierRule, held: boolean): boolean => {
  if (rule === 'required') {
    return held;
  }
  if (rule === 'forbidden') {
    return !held;
  }
  return true;
};

/** Whether `chord` is the key event `binding` answers, in `chord`'s mode. */
export const matchBinding = (binding: Binding, chord: Chord): boolean => {
  if ((binding.mode ?? 'edit') !== (chord.mode ?? 'edit')) {
    return false;
  }
  if (binding.key !== keyToken(chord.key)) {
    return false;
  }
  const rules = rulesFor(binding);

  return (
    holds(rules.alt, chord.alt ?? false) &&
    holds(rules.command, chord.command ?? false) &&
    holds(rules.shift, chord.shift ?? false)
  );
};

/** The command `chord` runs, case-insensitively, or `null` when nothing is bound. */
export const resolveKey = (chord: Chord): Command | null =>
  KEYMAP.find((binding) => matchBinding(binding, chord))?.command ?? null;
