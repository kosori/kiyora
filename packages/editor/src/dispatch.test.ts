import {
  type CommandHost,
  createEditor,
  type Editor,
  GRID,
  KEYMAP,
  NUDGE_STEP,
  runCommand,
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

/** A one-shape board, so a command has something to change. */
const board = (shapes: unknown[]): Board =>
  parseBoard({
    camera: { x: 0, y: 0, zoom: 1 },
    createdAt: 1_700_000_000_000,
    deck: [],
    id: 'board-1',
    schemaVersion: SCHEMA_VERSION,
    settings: { theme: 'light' },
    shapes,
    title: 'Untitled',
    updatedAt: 1_700_000_000_000,
  });

/** The app's side of the dispatch, recording what the engine cannot do alone. */
const recordingHost = (): { calls: string[]; host: CommandHost } => {
  const calls: string[] = [];

  return {
    calls,
    host: {
      camera: (action, phase) => calls.push(`${action}:${phase}`),
      showShortcuts: () => calls.push('shortcuts'),
    },
  };
};

/** The board's only shape, read after a command has moved it. */
const squareOf = (editor: Editor) => editor.getBoard().shapes[0];

describe('the one dispatch', () => {
  it('runs an editing command, so a command from the palette or the menu takes the keyboard path', () => {
    const editor = createEditor(board([]));

    runCommand(
      { kind: 'tool', tool: 'rectangle' },
      {
        editor,
        host: recordingHost().host,
      }
    );

    expect(editor.getTool()).toBe('rectangle');
  });

  it('moves the selection by the step the command carries, so a coarse nudge is still one grid', () => {
    const editor = createEditor(board([square]));
    editor.setSelection(['square']);
    const { host } = recordingHost();

    runCommand(
      { coarse: false, dx: 1, dy: 0, kind: 'nudge' },
      { editor, host }
    );
    expect(squareOf(editor)?.x).toBe(NUDGE_STEP);

    runCommand({ coarse: true, dx: 1, dy: 0, kind: 'nudge' }, { editor, host });
    expect(squareOf(editor)?.x).toBe(NUDGE_STEP + GRID);
  });

  it('hands the camera and the shortcut sheet to the app, because the engine owns neither', () => {
    const editor = createEditor(board([]));
    const { calls, host } = recordingHost();

    runCommand({ action: 'zoom-in', kind: 'camera' }, { editor, host });
    runCommand({ kind: 'show-shortcuts' }, { editor, host });

    expect(calls).toEqual(['zoom-in:down', 'shortcuts']);
  });

  it('aligns through the dispatch, so the Inspector runs the command the key runs', () => {
    const editor = createEditor(
      board([square, { ...square, id: 'other', x: 200 }])
    );
    editor.setSelection(['square', 'other']);

    runCommand({ alignment: 'left', kind: 'align' }, { editor });

    expect(editor.getBoard().shapes.map((shape) => shape.x)).toEqual([0, 0]);
  });

  it('undoes through the dispatch, so history is not a path the keyboard owns alone', () => {
    const editor = createEditor(board([square]));
    editor.setSelection(['square']);
    const { host } = recordingHost();

    runCommand({ kind: 'delete' }, { editor, host });
    expect(editor.getBoard().shapes).toHaveLength(0);

    runCommand({ kind: 'undo' }, { editor, host });
    expect(editor.getBoard().shapes).toHaveLength(1);
  });

  it('runs every command the keymap binds, so no chord can reach a kind with no handler', () => {
    const editor = createEditor(board([]));
    const { host } = recordingHost();

    for (const binding of KEYMAP) {
      expect(() => runCommand(binding.command, { editor, host })).not.toThrow();
    }
  });
});
