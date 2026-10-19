import {
  bindingKey,
  CAMERA_ACTIONS,
  KEYMAP,
  resolveKey,
  SHORTCUT_ROWS,
  shortcutReference,
} from '@kiyora/editor';
import { describe, expect, it } from 'vitest';

describe('the keymap', () => {
  it('resolves a key to the command it declares, so the dialog and the handler agree', () => {
    expect(resolveKey('v')).toEqual({ kind: 'tool', tool: 'select' });
    expect(resolveKey('r')).toEqual({ kind: 'tool', tool: 'rectangle' });
    expect(resolveKey('?')).toEqual({ kind: 'show-shortcuts' });
  });

  it('resolves the camera keys, so zooming is declared like every other binding', () => {
    expect(resolveKey(' ')).toEqual({ action: 'pan', kind: 'camera' });
    expect(resolveKey('=')).toEqual({ action: 'zoom-in', kind: 'camera' });
    expect(resolveKey('+')).toEqual({ action: 'zoom-in', kind: 'camera' });
    expect(resolveKey('-')).toEqual({ action: 'zoom-out', kind: 'camera' });
    expect(resolveKey('_')).toEqual({ action: 'zoom-out', kind: 'camera' });
  });

  it('leaves an unbound key alone, so typing cannot change a tool', () => {
    expect(resolveKey('q')).toBeNull();
  });

  it('binds each key once, so two commands cannot fight over one key', () => {
    const keys = KEYMAP.map((binding) => binding.key);

    expect(new Set(keys).size).toBe(keys.length);
  });

  it('gives every declared binding a row in the reference, so a binding cannot hide from the dialog', () => {
    const shown = new Set(shortcutReference().map((row) => row.key));

    for (const binding of KEYMAP) {
      expect(shown.has(binding.key)).toBe(true);
    }
  });

  it('shows no row the keymap cannot key, so the dialog never teaches a dead shortcut', () => {
    for (const row of SHORTCUT_ROWS) {
      expect(bindingKey(row.command)).not.toBeNull();
    }
  });

  it('declares a key for every camera action the surface honours, so a working key cannot stay invisible', () => {
    for (const action of CAMERA_ACTIONS) {
      expect(bindingKey({ action, kind: 'camera' })).not.toBeNull();
    }
  });

  it('lists every camera action in the reference, so the sheet does not omit the keys that zoom', () => {
    const rows = shortcutReference();

    for (const action of CAMERA_ACTIONS) {
      const key = bindingKey({ action, kind: 'camera' });

      expect(rows.some((row) => row.key === key)).toBe(true);
    }
  });

  it('shows the key the keymap binds, not a copy, so the reference cannot drift', () => {
    const row = shortcutReference().find((line) => line.label === 'Rectangle');

    expect(row?.key).toBe('r');
  });
});
