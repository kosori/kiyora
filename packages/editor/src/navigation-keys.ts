import type { Command } from './commands';
import type { Binding, ShortcutRow } from './keymap';
import { NAVIGATION_DIRECTIONS, type NavigationDirection } from './navigation';

/** The arrow each step answers to, so a binding and its copy cannot drift. */
const KEY_OF: Record<NavigationDirection, string> = {
  down: 'arrowdown',
  left: 'arrowleft',
  right: 'arrowright',
  up: 'arrowup',
};

/** One step and the words the reference and the palette read it under. */
const STEPS: readonly { direction: NavigationDirection; label: string }[] = [
  { direction: 'up', label: 'Move up' },
  { direction: 'down', label: 'Move down' },
  { direction: 'left', label: 'Move left' },
  { direction: 'right', label: 'Move right' },
];

/** One binding on a step: spatial navigation, while the canvas holds focus. */
const stepBinding = (direction: NavigationDirection): Binding => ({
  command: { direction, kind: 'navigate-move' },
  focus: 'canvas',
  key: KEY_OF[direction],
  mode: 'navigate',
  preventDefault: true,
});

/**
 * The shape-navigation keys. Enter enters the mode from the canvas; in the mode
 * the arrows step the selection by geometry rather than nudging it, so an arrow
 * has one meaning at a time and the two never fight over the chord. Escape
 * leaves the mode, which is its own binding rather than the editing cancel, and
 * every other binding waits in the edit mode until it does. All of them are
 * bound to the canvas, so the same keys on a control stay the control's.
 */
export const NAVIGATION_BINDINGS: readonly Binding[] = [
  {
    command: { kind: 'navigate-enter' },
    focus: 'canvas',
    key: 'enter',
    preventDefault: true,
  },
  ...NAVIGATION_DIRECTIONS.map(stepBinding),
  {
    command: { kind: 'navigate-exit' },
    focus: 'canvas',
    key: 'escape',
    mode: 'navigate',
    preventDefault: true,
  },
];

/** One row of the reference, in the group its copy belongs to. */
const row = (command: Command, label: string): ShortcutRow => ({
  commands: [command],
  group: 'Selection',
  label,
});

/** The reference rows for the navigation keys, whose keys the keymap supplies. */
export const NAVIGATION_ROWS: readonly ShortcutRow[] = [
  row({ kind: 'navigate-enter' }, 'Enter shape navigation'),
  ...STEPS.map((step) =>
    row({ direction: step.direction, kind: 'navigate-move' }, step.label)
  ),
  row({ kind: 'navigate-exit' }, 'Leave shape navigation'),
];
