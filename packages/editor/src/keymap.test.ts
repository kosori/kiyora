import {
  type Binding,
  bindingKey,
  bindingLabel,
  CAMERA_ACTIONS,
  type Chord,
  type Command,
  commandId,
  commandKeyFor,
  commandPalette,
  DISPATCHED_KINDS,
  KEY_MODES,
  KEYMAP,
  keyshortcutsFor,
  matchBinding,
  resolveKey,
  SHORTCUT_ROWS,
  shortcutReference,
} from '@kiyora/editor';
import { describe, expect, it } from 'vitest';

/** The platform these checks read the reference on; macOS has its own test. */
const OTHER = 'other' as const;

const nudge = (dx: number, dy: number, coarse: boolean): Command => ({
  coarse,
  dx,
  dy,
  kind: 'nudge',
});

/** A chord that matches a binding: a modifier held only where the binding requires it. */
const chordOf = (binding: Binding): Chord => ({
  alt: binding.modifiers?.alt === 'required',
  command: binding.modifiers?.command === 'required',
  key: binding.key,
  mode: binding.mode,
  shift: binding.modifiers?.shift === 'required',
});

describe('the keymap', () => {
  it('resolves a key to the command it declares, so the dialog and the handler agree', () => {
    expect(resolveKey({ key: 'v' })).toEqual({ kind: 'tool', tool: 'select' });
    expect(resolveKey({ key: 'r' })).toEqual({
      kind: 'tool',
      tool: 'rectangle',
    });
    expect(resolveKey({ key: '?' })).toEqual({ kind: 'show-shortcuts' });
  });

  it('resolves the camera keys, so zooming is declared like every other binding', () => {
    expect(resolveKey({ key: ' ' })).toEqual({ action: 'pan', kind: 'camera' });
    expect(resolveKey({ key: '=' })).toEqual({
      action: 'zoom-in',
      kind: 'camera',
    });
    expect(resolveKey({ key: '+', shift: true })).toEqual({
      action: 'zoom-in',
      kind: 'camera',
    });
    expect(resolveKey({ key: '-' })).toEqual({
      action: 'zoom-out',
      kind: 'camera',
    });
    expect(resolveKey({ key: '_', shift: true })).toEqual({
      action: 'zoom-out',
      kind: 'camera',
    });
  });

  it('resolves a modified key to the binding that declares it, so shift can mean a coarser step', () => {
    expect(resolveKey({ key: 'ArrowRight' })).toEqual(nudge(1, 0, false));
    expect(resolveKey({ key: 'ArrowRight', shift: true })).toEqual(
      nudge(1, 0, true)
    );
    expect(resolveKey({ key: 'ArrowUp', shift: true })).toEqual(
      nudge(0, -1, true)
    );
    expect(resolveKey({ key: 'Escape' })).toEqual({ kind: 'cancel-gesture' });
  });

  it('refuses a modified key nothing declares, so the app cannot honour a shortcut the keymap does not', () => {
    expect(resolveKey({ alt: true, key: 'ArrowRight' })).toBeNull();
    expect(resolveKey({ command: true, key: 'ArrowRight' })).toBeNull();
    expect(
      resolveKey({ alt: true, key: 'ArrowRight', shift: true })
    ).toBeNull();
    expect(
      resolveKey({ command: true, key: 'ArrowRight', shift: true })
    ).toBeNull();
    expect(resolveKey({ alt: true, key: 'Escape' })).toBeNull();
    expect(resolveKey({ command: true, key: 'Escape' })).toBeNull();
    expect(resolveKey({ alt: true, key: 'q' })).toBeNull();
    expect(resolveKey({ command: true, key: 'q' })).toBeNull();
    expect(resolveKey({ key: 'q' })).toBeNull();
  });

  it("resolves every binding it declares to that binding's command, so the keymap and the handler cannot disagree", () => {
    for (const binding of KEYMAP) {
      expect(resolveKey(chordOf(binding))).toEqual(binding.command);
    }
  });

  it('resolves each key and modifier combination to at most one command per mode, so two bindings cannot fight over one chord', () => {
    const flags = [false, true] as const;

    for (const mode of KEY_MODES) {
      for (const key of new Set(KEYMAP.map((binding) => binding.key))) {
        for (const shift of flags) {
          for (const alt of flags) {
            for (const command of flags) {
              const matched = KEYMAP.filter((binding) =>
                matchBinding(binding, { alt, command, key, mode, shift })
              );

              expect(matched.length).toBeLessThanOrEqual(1);
            }
          }
        }
      }
    }
  });

  it('can require or forbid each modifier, so a binding varies by one without a row per combination', () => {
    const command: Command = { kind: 'show-shortcuts' };
    const binding: Binding = {
      command,
      key: 'a',
      modifiers: { alt: 'required', command: 'forbidden', shift: 'forbidden' },
    };

    expect(matchBinding(binding, { alt: true, key: 'a' })).toBe(true);
    expect(matchBinding(binding, { key: 'a' })).toBe(false);
    expect(matchBinding(binding, { alt: true, command: true, key: 'a' })).toBe(
      false
    );
    expect(matchBinding(binding, { alt: true, key: 'a', shift: true })).toBe(
      false
    );

    const ignored: Binding = {
      command,
      key: 'b',
      modifiers: { shift: 'ignored' },
    };

    expect(matchBinding(ignored, { key: 'b', shift: true })).toBe(true);
  });

  it('gives every declared binding a row in the reference, so a binding cannot hide from the dialog', () => {
    const shown = new Set(shortcutReference(OTHER).flatMap((row) => row.keys));

    for (const binding of KEYMAP) {
      expect(shown.has(bindingLabel(binding, OTHER))).toBe(true);
    }
  });

  it('shows no row the keymap cannot key, so the dialog never teaches a dead shortcut', () => {
    for (const row of SHORTCUT_ROWS) {
      for (const command of row.commands) {
        expect(bindingKey(command)).not.toBeNull();
      }
    }
  });

  it('declares a key for every camera action the surface honours, so a working key cannot stay invisible', () => {
    for (const action of CAMERA_ACTIONS) {
      expect(bindingKey({ action, kind: 'camera' })).not.toBeNull();
    }
  });

  it('lists every camera action in the reference, so the sheet does not omit the keys that zoom', () => {
    const shown = shortcutReference(OTHER).flatMap((row) => row.keys);

    for (const action of CAMERA_ACTIONS) {
      const binding = KEYMAP.find(
        (candidate) =>
          candidate.command.kind === 'camera' &&
          candidate.command.action === action
      );

      expect(binding).toBeDefined();
      if (binding !== undefined) {
        expect(shown).toContain(bindingLabel(binding, OTHER));
      }
    }
  });

  it('shows the key the keymap binds, not a copy, so the reference cannot drift', () => {
    const row = shortcutReference(OTHER).find(
      (line) => line.label === 'Rectangle'
    );

    expect(row?.keys).toEqual(['R']);
  });

  it('reads aria-keyshortcuts from the same keymap, so a control cannot advertise a dead chord', () => {
    expect(keyshortcutsFor({ kind: 'tool', tool: 'rectangle' }, OTHER)).toBe(
      'r'
    );
    expect(keyshortcutsFor({ kind: 'undo' }, OTHER)).toBe('Control+z');
    expect(keyshortcutsFor({ kind: 'redo' }, OTHER)).toBe('Control+Shift+Z');
    expect(keyshortcutsFor({ action: 'zoom-in', kind: 'camera' }, OTHER)).toBe(
      '='
    );
    expect(keyshortcutsFor({ kind: 'delete' }, OTHER)).toBe('Delete Backspace');
    expect(
      keyshortcutsFor({ kind: 'tool', tool: 'hand' }, OTHER)
    ).toBeUndefined();
  });

  it('names ⌘ on macOS in the sheet and Meta in aria-keyshortcuts, so neither teaches a key the platform lacks', () => {
    expect(commandKeyFor('other')).toEqual({ aria: 'Control', label: 'Ctrl' });
    expect(commandKeyFor('macos')).toEqual({ aria: 'Meta', label: '⌘' });

    expect(
      shortcutReference('macos').find((row) => row.label === 'Undo')?.keys
    ).toEqual(['⌘ + Z']);
    expect(keyshortcutsFor({ kind: 'undo' }, 'macos')).toBe('Meta+z');
    expect(
      shortcutReference(OTHER).find((row) => row.label === 'Undo')?.keys
    ).toEqual(['Ctrl + Z']);
  });

  it('lists the arrows the keymap declares, so a modifier binding adds no hand-written row', () => {
    const rows = shortcutReference(OTHER);

    expect(rows.find((row) => row.label === 'Nudge by a pixel')?.keys).toEqual([
      '↑',
      '↓',
      '←',
      '→',
    ]);
    expect(
      rows.find((row) => row.label === 'Nudge by a grid step')?.keys
    ).toEqual(['Shift + ↑', 'Shift + ↓', 'Shift + ←', 'Shift + →']);
    expect(rows.find((row) => row.label === 'Cancel a gesture')?.keys).toEqual([
      'Esc',
    ]);
  });
});

describe('the one dispatch', () => {
  it('has a dispatch for every command the keymap binds, so no chord can land with nothing to run', () => {
    const dispatched = new Set<Command['kind']>(DISPATCHED_KINDS);

    for (const binding of KEYMAP) {
      expect(dispatched.has(binding.command.kind)).toBe(true);
    }
  });

  it('binds every command the dispatch runs, so no execution path can hide from the keyboard', () => {
    const bound = new Set(KEYMAP.map((binding) => binding.command.kind));

    for (const kind of DISPATCHED_KINDS) {
      expect(bound.has(kind)).toBe(true);
    }
  });
});

describe('undo and redo keys', () => {
  it('binds undo to the command key and redo to its shifted form', () => {
    expect(resolveKey({ command: true, key: 'z' })).toEqual({ kind: 'undo' });
    expect(resolveKey({ command: true, key: 'z', shift: true })).toEqual({
      kind: 'redo',
    });
  });

  it('leaves a bare z alone, so undo is not the letter that types a shape', () => {
    expect(resolveKey({ key: 'z' })).toBeNull();
    expect(resolveKey({ key: 'z', shift: true })).toBeNull();
  });

  it('shows undo and redo in the reference, with the keys read from the keymap', () => {
    const rows = shortcutReference(OTHER);

    expect(rows.find((row) => row.label === 'Undo')?.keys).toEqual([
      'Ctrl + Z',
    ]);
    expect(rows.find((row) => row.label === 'Redo')?.keys).toEqual([
      'Ctrl + Shift + Z',
    ]);
  });
});

describe('the ordering keys', () => {
  it('steps one place on the bracket and jumps to either end with shift', () => {
    expect(resolveKey({ command: true, key: ']' })).toEqual({
      kind: 'bring-forward',
    });
    expect(resolveKey({ command: true, key: '[' })).toEqual({
      kind: 'send-backward',
    });
    expect(resolveKey({ command: true, key: ']', shift: true })).toEqual({
      kind: 'bring-to-front',
    });
    expect(resolveKey({ command: true, key: '[', shift: true })).toEqual({
      kind: 'send-to-back',
    });
  });

  it('resolves the shifted bracket a keyboard actually produces', () => {
    expect(resolveKey({ command: true, key: '}', shift: true })).toEqual({
      kind: 'bring-to-front',
    });
    expect(resolveKey({ command: true, key: '{', shift: true })).toEqual({
      kind: 'send-to-back',
    });
  });

  it('shows the ordering keys in the reference, read from the keymap', () => {
    const rows = shortcutReference(OTHER);

    expect(rows.find((row) => row.label === 'Bring to front')?.keys).toEqual([
      'Ctrl + Shift + ]',
    ]);
    expect(rows.find((row) => row.label === 'Bring forward')?.keys).toEqual([
      'Ctrl + ]',
    ]);
    expect(rows.find((row) => row.label === 'Send backward')?.keys).toEqual([
      'Ctrl + [',
    ]);
    expect(rows.find((row) => row.label === 'Send to back')?.keys).toEqual([
      'Ctrl + Shift + [',
    ]);
  });
});

describe('the clipboard keys', () => {
  it('duplicates, copies, cuts and pastes on the command key', () => {
    expect(resolveKey({ command: true, key: 'd' })).toEqual({
      kind: 'duplicate',
    });
    expect(resolveKey({ command: true, key: 'c' })).toEqual({ kind: 'copy' });
    expect(resolveKey({ command: true, key: 'c', shift: true })).toEqual({
      kind: 'copy-png',
    });
    expect(resolveKey({ command: true, key: 'x' })).toEqual({ kind: 'cut' });
    expect(resolveKey({ command: true, key: 'v' })).toEqual({ kind: 'paste' });
  });

  it('leaves the bare letters to the tools, so a copy is not a connector', () => {
    expect(resolveKey({ key: 'c' })).toEqual({
      kind: 'tool',
      tool: 'connector',
    });
    expect(resolveKey({ key: 'v' })).toEqual({ kind: 'tool', tool: 'select' });
  });

  it('shows the clipboard keys in the reference, read from the keymap', () => {
    const rows = shortcutReference(OTHER);

    expect(rows.find((row) => row.label === 'Copy')?.keys).toEqual([
      'Ctrl + C',
    ]);
    expect(rows.find((row) => row.label === 'Copy as PNG')?.keys).toEqual([
      'Ctrl + Shift + C',
    ]);
    expect(rows.find((row) => row.label === 'Cut')?.keys).toEqual(['Ctrl + X']);
    expect(rows.find((row) => row.label === 'Paste')?.keys).toEqual([
      'Ctrl + V',
    ]);
    expect(rows.find((row) => row.label === 'Duplicate')?.keys).toEqual([
      'Ctrl + D',
    ]);
  });
});

describe('the lock key', () => {
  it('locks or unlocks the selection from the keyboard, so the menu has a command to run', () => {
    expect(resolveKey({ key: 'l' })).toEqual({ kind: 'lock' });
    expect(resolveKey({ command: true, key: 'l' })).toBeNull();
  });

  it('shows the lock key in the reference, read from the keymap', () => {
    expect(
      shortcutReference(OTHER).find((row) => row.label === 'Lock or unlock')
        ?.keys
    ).toEqual(['L']);
  });
});

describe('the find key', () => {
  it('opens find on the command key, and leaves the bare letter to the frame tool', () => {
    expect(resolveKey({ command: true, key: 'f' })).toEqual({ kind: 'find' });
    expect(resolveKey({ key: 'f' })).toEqual({ kind: 'tool', tool: 'frame' });
  });

  it('shows find in the reference, read from the keymap', () => {
    expect(
      shortcutReference(OTHER).find((row) => row.label === 'Find on board')
        ?.keys
    ).toEqual(['Ctrl + F']);
  });
});

describe('the zen key', () => {
  it('hides the chrome on the backslash and shows it in the reference', () => {
    expect(resolveKey({ key: '\\' })).toEqual({ kind: 'zen' });
    expect(
      shortcutReference(OTHER).find((row) => row.label === 'Zen mode')?.keys
    ).toEqual(['\\']);
  });
});

describe('the arrange keys', () => {
  it('resolves the six alignments and the two distributions', () => {
    expect(resolveKey({ alt: true, key: 'a' })).toEqual({
      alignment: 'left',
      kind: 'align',
    });
    expect(resolveKey({ alt: true, key: 'h' })).toEqual({
      alignment: 'center-horizontal',
      kind: 'align',
    });
    expect(resolveKey({ alt: true, key: 'd' })).toEqual({
      alignment: 'right',
      kind: 'align',
    });
    expect(resolveKey({ alt: true, key: 'w' })).toEqual({
      alignment: 'top',
      kind: 'align',
    });
    expect(resolveKey({ alt: true, key: 'v' })).toEqual({
      alignment: 'center-vertical',
      kind: 'align',
    });
    expect(resolveKey({ alt: true, key: 's' })).toEqual({
      alignment: 'bottom',
      kind: 'align',
    });
    expect(resolveKey({ alt: true, key: 'h', shift: true })).toEqual({
      axis: 'x',
      kind: 'distribute',
    });
    expect(resolveKey({ alt: true, key: 'v', shift: true })).toEqual({
      axis: 'y',
      kind: 'distribute',
    });
  });

  it('shows the arrange keys in the reference, read from the keymap', () => {
    const rows = shortcutReference(OTHER);

    expect(rows.find((row) => row.label === 'Align left')?.keys).toEqual([
      'Alt + A',
    ]);
    expect(rows.find((row) => row.label === 'Align right')?.keys).toEqual([
      'Alt + D',
    ]);
    expect(rows.find((row) => row.label === 'Align top')?.keys).toEqual([
      'Alt + W',
    ]);
    expect(rows.find((row) => row.label === 'Align bottom')?.keys).toEqual([
      'Alt + S',
    ]);
    expect(
      rows.find((row) => row.label === 'Align centre horizontally')?.keys
    ).toEqual(['Alt + H']);
    expect(
      rows.find((row) => row.label === 'Align centre vertically')?.keys
    ).toEqual(['Alt + V']);
    expect(
      rows.find((row) => row.label === 'Distribute horizontally')?.keys
    ).toEqual(['Alt + Shift + H']);
    expect(
      rows.find((row) => row.label === 'Distribute vertically')?.keys
    ).toEqual(['Alt + Shift + V']);
  });
});

describe('the presenting keys', () => {
  it('navigates and leaves while presenting, so a slide show needs no pointer', () => {
    expect(resolveKey({ key: 'ArrowRight', mode: 'present' })).toEqual({
      kind: 'present-next',
    });
    expect(resolveKey({ key: ' ', mode: 'present' })).toEqual({
      kind: 'present-next',
    });
    expect(resolveKey({ key: 'ArrowLeft', mode: 'present' })).toEqual({
      kind: 'present-previous',
    });
    expect(resolveKey({ key: 'Escape', mode: 'present' })).toEqual({
      kind: 'present-exit',
    });
  });

  it('leaves the editing meaning of those keys alone, because a mode is what differs', () => {
    expect(resolveKey({ key: 'ArrowRight' })).toEqual(nudge(1, 0, false));
    expect(resolveKey({ key: ' ' })).toEqual({ action: 'pan', kind: 'camera' });
    expect(resolveKey({ key: 'Escape' })).toEqual({ kind: 'cancel-gesture' });
    expect(resolveKey({ key: 'p' })).toEqual({ kind: 'present' });
  });

  it('honours no editing key while presenting, so the board cannot change behind a slide', () => {
    expect(resolveKey({ key: 'v', mode: 'present' })).toBeNull();
    expect(resolveKey({ key: 'r', mode: 'present' })).toBeNull();
    expect(resolveKey({ command: true, key: 'z', mode: 'present' })).toBeNull();
  });

  it('lists every presenting key in the reference, read from the keymap', () => {
    const rows = shortcutReference(OTHER);

    expect(rows.find((row) => row.label === 'Present')?.keys).toEqual(['P']);
    expect(rows.find((row) => row.label === 'Next slide')?.keys).toEqual([
      '→',
      '↓',
      'Space',
      'PgDn',
    ]);
    expect(rows.find((row) => row.label === 'Previous slide')?.keys).toEqual([
      '←',
      '↑',
      'PgUp',
    ]);
    expect(rows.find((row) => row.label === 'Toggle notes')?.keys).toEqual([
      'N',
    ]);
    expect(rows.find((row) => row.label === 'Toggle timer')?.keys).toEqual([
      'T',
    ]);
    expect(rows.find((row) => row.label === 'Leave presenting')?.keys).toEqual([
      'Esc',
    ]);
  });
});

describe('the command palette', () => {
  it('shows exactly the rows the reference shows, with their keys and labels, so the two cannot disagree', () => {
    const reference = shortcutReference(OTHER);
    const palette = commandPalette(OTHER).map(({ group, keys, label }) => ({
      group,
      keys,
      label,
    }));

    expect(palette).toEqual(reference);
  });

  it('lists every command the keymap binds, and nothing else', () => {
    const listed = new Set(
      commandPalette(OTHER).flatMap((entry) =>
        entry.commands.map((command) => commandId(command))
      )
    );
    const bound = new Set(KEYMAP.map((binding) => commandId(binding.command)));

    expect(listed).toEqual(bound);
  });
});

describe('the command palette key', () => {
  it('opens the palette on the command key, so the palette is a binding like any other', () => {
    expect(resolveKey({ command: true, key: 'k' })).toEqual({
      kind: 'palette',
    });
  });

  it('shows the palette key in the reference, read from the keymap', () => {
    const row = shortcutReference(OTHER).find(
      (line) => line.label === 'Command palette'
    );

    expect(row?.keys).toEqual(['Ctrl + K']);
  });
});
