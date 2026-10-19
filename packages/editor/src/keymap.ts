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
  | { kind: 'camera'; action: CameraAction };

/** A stable name for a command, so the keymap and the reference can join. */
export const commandId = (command: Command): string => {
  if (command.kind === 'tool') {
    return `tool.${command.tool}`;
  }
  if (command.kind === 'camera') {
    return `camera.${command.action}`;
  }
  return command.kind;
};

/** One binding: the key, and the command it runs. */
export type Binding = {
  command: Command;
  key: string;
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
 * Every binding, in one place. A binding is a key and the command it runs;
 * nothing else declares one, so the dialog and the handler cannot disagree
 * about what a key does.
 */
export const KEYMAP: readonly Binding[] = [
  { command: { kind: 'tool', tool: 'select' }, key: 'v' },
  { command: { kind: 'tool', tool: 'rectangle' }, key: 'r' },
  { command: { kind: 'tool', tool: 'text' }, key: 't' },
  { command: { action: 'pan', kind: 'camera' }, key: 'space' },
  { command: { action: 'zoom-in', kind: 'camera' }, key: '=' },
  { command: { action: 'zoom-out', kind: 'camera' }, key: '-' },
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
    command: { kind: 'tool', tool: 'text' },
    group: 'Tools',
    label: 'Text',
  },
  {
    command: { action: 'pan', kind: 'camera' },
    group: 'View',
    label: 'Pan (hold)',
  },
  {
    command: { action: 'zoom-in', kind: 'camera' },
    group: 'View',
    label: 'Zoom in',
  },
  {
    command: { action: 'zoom-out', kind: 'camera' },
    group: 'View',
    label: 'Zoom out',
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
export const resolveKey = (key: string): Command | null =>
  KEYMAP.find((binding) => binding.key === keyToken(key))?.command ?? null;
