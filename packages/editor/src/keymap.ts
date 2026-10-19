import type { Tool } from './tools';

/**
 * Every camera action the surface honours, and the source of the `CameraAction`
 * union: a test walks this list, so an action added to the surface without a key
 * and a reference row fails rather than quietly working behind the dialog's back.
 */
export const CAMERA_ACTIONS = ['pan', 'zoom-in', 'zoom-out'] as const;

/** What a camera key does. The surface supplies the anchor; the keymap supplies the action. */
export type CameraAction = (typeof CAMERA_ACTIONS)[number];

/** A command a key runs. */
export type Command =
  | { kind: 'tool'; tool: Tool }
  | { kind: 'show-shortcuts' }
  | { kind: 'camera'; action: CameraAction }
  | { kind: 'nudge'; dx: number; dy: number; coarse: boolean }
  | { kind: 'cancel-gesture' }
  | { kind: 'undo' }
  | { kind: 'redo' };

/** A stable name for a command, so the keymap and the reference can join. */
export const commandId = (command: Command): string => {
  if (command.kind === 'tool') {
    return `tool.${command.tool}`;
  }
  if (command.kind === 'camera') {
    return `camera.${command.action}`;
  }
  if (command.kind === 'nudge') {
    return `nudge.${command.dx}.${command.dy}.${command.coarse ? 'coarse' : 'fine'}`;
  }
  return command.kind;
};

/**
 * How a binding treats one modifier: it must be held, must not be held, or does
 * not care. Two bindings on the same key differ by setting this one way here and
 * the other way there, rather than by spelling the combination into the key.
 */
export type ModifierRule = 'required' | 'forbidden' | 'ignored';

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
const rulesFor = (binding: Binding): Required<Modifiers> => ({
  alt: binding.modifiers?.alt ?? DEFAULT_MODIFIERS.alt,
  command: binding.modifiers?.command ?? DEFAULT_MODIFIERS.command,
  shift: binding.modifiers?.shift ?? DEFAULT_MODIFIERS.shift,
});

/** One binding: the key, the modifiers it constrains, and the command it runs. */
export type Binding = {
  command: Command;
  key: string;
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
 * Every binding, in one place. A binding is a key, the modifiers it requires or
 * forbids, and the command it runs; nothing else declares one, so the dialog and
 * the handler cannot disagree about what a key does.
 */
export const KEYMAP: readonly Binding[] = [
  { command: { kind: 'tool', tool: 'select' }, key: 'v' },
  { command: { kind: 'tool', tool: 'rectangle' }, key: 'r' },
  { command: { action: 'pan', kind: 'camera' }, key: 'space' },
  { command: { action: 'zoom-in', kind: 'camera' }, key: '=' },
  { command: { action: 'zoom-out', kind: 'camera' }, key: '-' },
  { command: { kind: 'show-shortcuts' }, key: '?' },
  { command: { kind: 'cancel-gesture' }, key: 'escape' },
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

/** One line of the reference: the copy, and the commands it names. */
export type ShortcutRow = {
  commands: readonly Command[];
  group: string;
  label: string;
};

/** The nudge commands the keymap declares at one granularity, so the sheet follows it. */
const nudgeCommands = (coarse: boolean): Command[] =>
  KEYMAP.flatMap((binding) =>
    binding.command.kind === 'nudge' && binding.command.coarse === coarse
      ? [binding.command]
      : []
  );

/**
 * The reference's copy, in reading order. The keys are not repeated here: the
 * generator reads each one from the keymap, so the sheet shows what the app
 * runs or it shows nothing.
 */
export const SHORTCUT_ROWS: readonly ShortcutRow[] = [
  {
    commands: [{ kind: 'tool', tool: 'select' }],
    group: 'Tools',
    label: 'Select',
  },
  {
    commands: [{ kind: 'tool', tool: 'rectangle' }],
    group: 'Tools',
    label: 'Rectangle',
  },
  {
    commands: [{ action: 'pan', kind: 'camera' }],
    group: 'View',
    label: 'Pan (hold)',
  },
  {
    commands: [{ action: 'zoom-in', kind: 'camera' }],
    group: 'View',
    label: 'Zoom in',
  },
  {
    commands: [{ action: 'zoom-out', kind: 'camera' }],
    group: 'View',
    label: 'Zoom out',
  },
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
  {
    commands: [{ kind: 'cancel-gesture' }],
    group: 'Selection',
    label: 'Cancel a gesture',
  },
  {
    commands: [{ kind: 'undo' }],
    group: 'History',
    label: 'Undo',
  },
  {
    commands: [{ kind: 'redo' }],
    group: 'History',
    label: 'Redo',
  },
  {
    commands: [{ kind: 'show-shortcuts' }],
    group: 'Help',
    label: 'Keyboard shortcuts',
  },
];

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
  space: 'Space',
};

/** The binding `command` is declared as, or `null` when nothing declares it. */
const bindingFor = (command: Command): Binding | null =>
  KEYMAP.find((binding) => commandId(binding.command) === commandId(command)) ??
  null;

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

/** The key `command` is bound to, or `null` when no binding declares it. */
export const bindingKey = (command: Command): string | null =>
  bindingFor(command)?.key ?? null;

/**
 * The shortcut reference, generated from the keymap: every row of copy, each
 * carrying the keys its commands are bound to.
 */
export const shortcutReference = (): ReferenceRow[] => {
  const rows: ReferenceRow[] = [];

  for (const row of SHORTCUT_ROWS) {
    const keys = row.commands.flatMap((command) => {
      const binding = bindingFor(command);

      return binding === null ? [] : [bindingLabel(binding)];
    });

    if (keys.length > 0) {
      rows.push({ group: row.group, keys, label: row.label });
    }
  }

  return rows;
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

/** A keyboard event as the keymap sees it: its key, and which modifiers are held. */
export type Chord = {
  alt?: boolean;
  /** The platform command key: meta on macOS, control elsewhere. */
  command?: boolean;
  key: string;
  shift?: boolean;
};

/** Whether `chord` is the key event `binding` answers. */
export const matchBinding = (binding: Binding, chord: Chord): boolean => {
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
