import {
  type Command,
  type ContextMenuItem,
  commandId,
  contextMenu,
  createEditor,
  DISPATCHED_KINDS,
  type Editor,
} from '@kiyora/editor';
import { type Board, parseBoard, SCHEMA_VERSION } from '@kiyora/model';
import { describe, expect, it } from 'vitest';

const style = {
  corner: 'sharp',
  dash: 'solid',
  fill: 'blue',
  fillStyle: 'pastel',
  stroke: 'ink',
  strokeWidth: 2,
} as const;

const square = {
  h: 100,
  id: 'square',
  kind: 'rectangle',
  locked: false,
  opacity: 1,
  parentId: null,
  rotation: 0,
  style,
  w: 100,
  x: 0,
  y: 0,
};

/** A board holding the shapes a menu test needs. */
const board = (shapes: unknown[]): Board =>
  parseBoard({
    camera: { x: 0, y: 0, zoom: 1 },
    createdAt: 1_700_000_000_000,
    deck: [],
    id: 'board-1',
    schemaVersion: SCHEMA_VERSION,
    settings: { theme: 'light' },
    shapes,
    title: 'Board',
    updatedAt: 1_700_000_000_000,
  });

/** Every entry the menu would render, in reading order. */
const itemsOf = (editor: Editor, canPaste = false): ContextMenuItem[] =>
  contextMenu({
    board: editor.getBoard(),
    canPaste,
    selection: editor.getSelection(),
  }).flatMap((section) => section.items);

/** One entry, by its stable command id. */
const itemOf = (
  editor: Editor,
  id: string,
  canPaste = false
): ContextMenuItem => {
  const found = itemsOf(editor, canPaste).find(
    (item) => commandId(item.command) === id
  );
  if (found === undefined) {
    throw new Error(`the menu does not offer ${id}`);
  }
  return found;
};

/** The ids the menu offers, in reading order. */
const idsOf = (editor: Editor, canPaste = false): string[] =>
  itemsOf(editor, canPaste).map((item) => commandId(item.command));

describe('the context menu', () => {
  it('offers cut, copy, duplicate, paste, delete, group, lock, align and order', () => {
    const editor = createEditor(
      board([square, { ...square, id: 'other', x: 200 }])
    );
    editor.setSelection(['square', 'other']);

    expect(idsOf(editor, true)).toEqual([
      'cut',
      'copy',
      'copy-png',
      'duplicate',
      'paste',
      'group',
      'ungroup',
      'lock',
      'delete',
      'align.left',
      'align.center-horizontal',
      'align.right',
      'align.top',
      'align.center-vertical',
      'align.bottom',
      'bring-to-front',
      'bring-forward',
      'send-backward',
      'send-to-back',
    ]);
  });

  it('runs every entry through the one dispatch, so the menu cannot grow a second implementation', () => {
    const editor = createEditor(
      board([square, { ...square, id: 'other', x: 200 }])
    );
    editor.setSelection(['square', 'other']);
    const dispatched = new Set<Command['kind']>(DISPATCHED_KINDS);

    expect(itemsOf(editor, true).length).toBeGreaterThan(0);
    for (const item of itemsOf(editor, true)) {
      expect(dispatched.has(item.command.kind)).toBe(true);
    }
  });

  it('leaves alignment and grouping disabled at one shape, because they have no target', () => {
    const editor = createEditor(board([square]));
    editor.setSelection(['square']);

    expect(itemOf(editor, 'group').disabled).toBe(true);
    expect(itemOf(editor, 'ungroup').disabled).toBe(true);
    for (const id of [
      'align.left',
      'align.center-horizontal',
      'align.right',
      'align.top',
      'align.center-vertical',
      'align.bottom',
    ]) {
      expect(itemOf(editor, id).disabled).toBe(true);
    }
    expect(itemOf(editor, 'cut').disabled).toBe(false);
    expect(itemOf(editor, 'copy').disabled).toBe(false);
    expect(itemOf(editor, 'copy-png').disabled).toBe(false);
    expect(itemOf(editor, 'duplicate').disabled).toBe(false);
    expect(itemOf(editor, 'delete').disabled).toBe(false);
    expect(itemOf(editor, 'lock').disabled).toBe(false);
    expect(itemOf(editor, 'bring-to-front').disabled).toBe(false);
  });

  it('disables everything that needs a selection when there is none', () => {
    const editor = createEditor(board([square]));

    for (const item of itemsOf(editor, false)) {
      expect(item.disabled).toBe(true);
    }
  });

  it('treats a connector as orderable but not as an item alignment arranges', () => {
    const editor = createEditor(board([square]));
    editor.setTool('connector');
    editor.placeShape({ from: { x: 0, y: 50 }, to: { x: 200, y: 50 } });
    const connector = editor
      .getBoard()
      .shapes.find((shape) => shape.kind === 'connector');
    if (connector === undefined) {
      throw new Error('the connector was not placed');
    }
    editor.setSelection([connector.id]);

    expect(itemOf(editor, 'align.left').disabled).toBe(true);
    expect(itemOf(editor, 'group').disabled).toBe(true);
    expect(itemOf(editor, 'bring-forward').disabled).toBe(false);
    expect(itemOf(editor, 'delete').disabled).toBe(false);
  });

  it('offers unlock for a locked shape, and no arrangement that would move it', () => {
    const editor = createEditor(
      board([square, { ...square, id: 'other', x: 200 }])
    );
    editor.setSelection(['square', 'other']);
    editor.setLocked(true);

    expect(itemOf(editor, 'lock').label).toBe('Unlock');
    for (const id of [
      'align.left',
      'align.center-horizontal',
      'align.right',
      'align.top',
      'align.center-vertical',
      'align.bottom',
    ]) {
      expect(itemOf(editor, id).disabled).toBe(true);
    }
    expect(itemOf(editor, 'delete').disabled).toBe(false);
  });

  it('keeps paste visible but disabled until the clipboard holds something', () => {
    const editor = createEditor(board([square]));
    editor.setSelection(['square']);

    expect(itemOf(editor, 'paste').disabled).toBe(true);

    editor.copy();

    expect(itemOf(editor, 'paste', editor.canPaste()).disabled).toBe(false);
  });

  it('writes nothing, so opening the menu is never a history entry or a save', () => {
    const editor = createEditor(
      board([square, { ...square, id: 'other', x: 200 }])
    );
    editor.setSelection(['square', 'other']);
    const before = editor.getBoard();

    itemsOf(editor, true);

    expect(editor.getBoard()).toBe(before);
    expect(editor.getHistory()).toEqual({ canRedo: false, canUndo: false });
  });
});
