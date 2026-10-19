/**
 * The modifier vocabulary every pointer gesture reads, decided here once so no
 * gesture invents its own meaning for a key:
 *
 * - `bypassSnap` (alt) — the gesture may leave the eight-pixel grid. A move and
 *   a resize both snap, so both honour it.
 * - `constrain` (shift) — the gesture's own constraint. Shift legitimately
 *   means a coarse nudge, a preserved ratio and a snapped rotation; which one
 *   applies is the gesture's business, but the key is declared here rather than
 *   re-decided inside each handler.
 *
 * Named collision: alt also grows a resize from its centre (from #9). Alt
 * therefore means both "bypass the snap" and "from the centre" on a resize.
 * Kept, because alt is the bypass key moves already use and the only sensible
 * centre key, so the two share it. The collision is named here, at the resize
 * that resolves it, and in the shortcut reference, rather than left silent.
 */

/** Which keyboard modifiers a pointer gesture reads. */
export type GestureModifiers = {
  /** Alt: the gesture may leave the grid. */
  bypassSnap: boolean;
  /** Shift: the gesture's own constraint — a coarse nudge, a kept ratio, a snapped rotation. */
  constrain: boolean;
};

/** No modifier held. */
export const NO_GESTURE_MODIFIERS: GestureModifiers = {
  bypassSnap: false,
  constrain: false,
};

/** The event fields the vocabulary reads. A mouse, pointer or keyboard event has both. */
export type ModifierSource = {
  altKey: boolean;
  shiftKey: boolean;
};

/** Reads the held modifiers. The one place the physical keys are named. */
export const gestureModifiers = ({
  altKey,
  shiftKey,
}: ModifierSource): GestureModifiers => ({
  bypassSnap: altKey,
  constrain: shiftKey,
});

/** One line of the pointer-modifier reference the dialog draws. */
export type GestureReferenceRow = {
  group: string;
  keys: readonly string[];
  label: string;
};

/**
 * The pointer gestures' modifiers, as the shortcut reference shows them. The
 * copy names alt's second meaning, so the dialog teaches the collision rather
 * than hiding it.
 */
export const GESTURE_REFERENCE: readonly GestureReferenceRow[] = [
  { group: 'Pointer', keys: ['Alt'], label: 'Bypass the grid snap' },
  {
    group: 'Pointer',
    keys: ['Alt'],
    label: 'Grow from the centre (a resize)',
  },
  {
    group: 'Pointer',
    keys: ['Shift'],
    label: 'Constrain: a coarse nudge, a kept ratio, a snapped rotation',
  },
];
