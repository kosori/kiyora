import {
  type Binding,
  bindingKey,
  bindingLabel,
  CAMERA_ACTIONS,
  type Chord,
  type Command,
  KEYMAP,
  matchBinding,
  resolveKey,
  SHORTCUT_ROWS,
  shortcutReference,
} from '@kiyora/editor';
import { describe, expect, it } from 'vitest';

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
    expect(resolveKey({ alt: true, key: 'v' })).toBeNull();
    expect(resolveKey({ command: true, key: 'v' })).toBeNull();
    expect(resolveKey({ key: 'q' })).toBeNull();
  });

  it("resolves every binding it declares to that binding's command, so the keymap and the handler cannot disagree", () => {
    for (const binding of KEYMAP) {
      expect(resolveKey(chordOf(binding))).toEqual(binding.command);
    }
  });

  it('resolves each key and modifier combination to at most one command, so two bindings cannot fight over one chord', () => {
    const flags = [false, true] as const;

    for (const key of new Set(KEYMAP.map((binding) => binding.key))) {
      for (const shift of flags) {
        for (const alt of flags) {
          for (const command of flags) {
            const matched = KEYMAP.filter((binding) =>
              matchBinding(binding, { alt, command, key, shift })
            );

            expect(matched.length).toBeLessThanOrEqual(1);
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
    const shown = new Set(shortcutReference().flatMap((row) => row.keys));

    for (const binding of KEYMAP) {
      expect(shown.has(bindingLabel(binding))).toBe(true);
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
    const shown = shortcutReference().flatMap((row) => row.keys);

    for (const action of CAMERA_ACTIONS) {
      const binding = KEYMAP.find(
        (candidate) =>
          candidate.command.kind === 'camera' &&
          candidate.command.action === action
      );

      expect(binding).toBeDefined();
      if (binding !== undefined) {
        expect(shown).toContain(bindingLabel(binding));
      }
    }
  });

  it('shows the key the keymap binds, not a copy, so the reference cannot drift', () => {
    const row = shortcutReference().find((line) => line.label === 'Rectangle');

    expect(row?.keys).toEqual(['R']);
  });

  it('lists the arrows the keymap declares, so a modifier binding adds no hand-written row', () => {
    const rows = shortcutReference();

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
    const rows = shortcutReference();

    expect(rows.find((row) => row.label === 'Undo')?.keys).toEqual([
      'Ctrl + Z',
    ]);
    expect(rows.find((row) => row.label === 'Redo')?.keys).toEqual([
      'Ctrl + Shift + Z',
    ]);
  });
});
