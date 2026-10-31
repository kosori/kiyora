import {
  type BoardChannel,
  type BoardMessage,
  clipboardMessage,
  createClipboardRelay,
  createEditor,
  createPresence,
  readClipboardMessage,
} from '@kiyora/editor';
import {
  type Board,
  type ConnectorShape,
  type FigureShape,
  type FrameShape,
  parseBoard,
  SCHEMA_VERSION,
  type Shape,
} from '@kiyora/model';
import { describe, expect, it } from 'vitest';

const style = {
  corner: 'sharp',
  dash: 'solid',
  fill: 'blue',
  fillStyle: 'pastel',
  stroke: 'ink',
  strokeWidth: 2,
} as const;

const rectangle = (overrides: Partial<FigureShape> = {}): Shape => ({
  h: 60,
  id: 'a',
  kind: 'rectangle',
  locked: false,
  opacity: 1,
  parentId: null,
  rotation: 0,
  style,
  w: 100,
  x: 0,
  y: 0,
  ...overrides,
});

const frame = (overrides: Partial<FrameShape> = {}): Shape => ({
  clip: true,
  h: 200,
  id: 'f',
  kind: 'frame',
  locked: false,
  opacity: 1,
  parentId: null,
  rotation: 0,
  style,
  variant: 'plain',
  w: 300,
  x: 0,
  y: 0,
  ...overrides,
});

const board = (shapes: Shape[]): Board =>
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

/** A channel every tab on it shares, the way BroadcastChannel spans tabs. */
const sharedChannel = (): BoardChannel => {
  const listeners = new Set<(message: BoardMessage) => void>();

  return {
    close: () => undefined,
    post: (message) => {
      for (const listener of [...listeners]) {
        listener(message);
      }
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};

describe('cross-tab clipboard', () => {
  it('sends the copied shapes themselves, tagged with the running schema version', () => {
    const channel = sharedChannel();
    const seen: BoardMessage[] = [];
    channel.subscribe((message) => seen.push(message));
    const first = createEditor(board([rectangle({ id: 'a', x: 80, y: 80 })]));
    const relay = createClipboardRelay({
      boardId: 'board-1',
      channel,
      editor: first,
      origin: 'one',
    });

    first.setSelection(['a']);
    first.copy();

    const message = seen.find((entry) => entry.type === 'clipboard');
    expect(message).toMatchObject({
      boardId: 'board-1',
      schemaVersion: SCHEMA_VERSION,
      type: 'clipboard',
    });
    if (message?.type !== 'clipboard') {
      throw new Error('the copy sent no clipboard message');
    }
    expect(message.shapes).toHaveLength(1);
    expect(message.shapes[0]).toMatchObject({ id: 'a', kind: 'rectangle' });

    relay.close();
  });

  it('pastes another tab’s copy with a fresh id and an offset', () => {
    const channel = sharedChannel();
    const first = createEditor(board([rectangle({ id: 'a', x: 80, y: 80 })]));
    const second = createEditor(board([]));
    const relays = [
      createClipboardRelay({
        boardId: 'board-1',
        channel,
        editor: first,
        origin: 'one',
      }),
      createClipboardRelay({
        boardId: 'board-1',
        channel,
        editor: second,
        origin: 'two',
      }),
    ];

    first.setSelection(['a']);
    first.copy();
    second.paste();

    const { shapes } = second.getBoard();
    expect(shapes).toHaveLength(1);
    expect(shapes[0]?.id).not.toBe('a');
    expect(shapes[0]).toMatchObject({ x: 104, y: 104 });

    for (const relay of relays) {
      relay.close();
    }
  });

  it('keeps a connector joined to the two copied shapes across tabs', () => {
    const channel = sharedChannel();
    const first = createEditor(
      board([rectangle({ id: 'a' }), rectangle({ id: 'b', x: 300 })])
    );
    first.setTool('connector');
    first.placeShape({ from: { x: 50, y: 30 }, to: { x: 350, y: 30 } });
    const second = createEditor(board([]));
    const relays = [
      createClipboardRelay({
        boardId: 'board-1',
        channel,
        editor: first,
        origin: 'one',
      }),
      createClipboardRelay({
        boardId: 'board-1',
        channel,
        editor: second,
        origin: 'two',
      }),
    ];

    first.setSelection(['a', 'b']);
    first.copy();
    second.paste();

    const connector = second
      .getBoard()
      .shapes.find(
        (shape): shape is ConnectorShape => shape.kind === 'connector'
      );
    expect(connector?.from).toEqual({ kind: 'bound', shapeId: 'rectangle-1' });
    expect(connector?.to).toEqual({ kind: 'bound', shapeId: 'rectangle-2' });

    for (const relay of relays) {
      relay.close();
    }
  });

  it('drops a connector bound to a shape that was not copied, so the other tab cannot dangle', () => {
    const channel = sharedChannel();
    const first = createEditor(
      board([rectangle({ id: 'a' }), rectangle({ id: 'b', x: 300 })])
    );
    first.setTool('connector');
    first.placeShape({ from: { x: 50, y: 30 }, to: { x: 350, y: 30 } });
    const second = createEditor(board([]));
    const relays = [
      createClipboardRelay({
        boardId: 'board-1',
        channel,
        editor: first,
        origin: 'one',
      }),
      createClipboardRelay({
        boardId: 'board-1',
        channel,
        editor: second,
        origin: 'two',
      }),
    ];

    first.setSelection(['a', 'connector-1']);
    first.copy();
    second.paste();

    expect(
      second.getBoard().shapes.some((shape) => shape.kind === 'connector')
    ).toBe(false);
    expect(second.getBoard().shapes).toHaveLength(1);

    for (const relay of relays) {
      relay.close();
    }
  });

  it('keeps a copied child inside its copied parent', () => {
    const channel = sharedChannel();
    const first = createEditor(
      board([frame(), rectangle({ id: 'm', parentId: 'f', x: 20, y: 20 })])
    );
    const second = createEditor(board([]));
    const relays = [
      createClipboardRelay({
        boardId: 'board-1',
        channel,
        editor: first,
        origin: 'one',
      }),
      createClipboardRelay({
        boardId: 'board-1',
        channel,
        editor: second,
        origin: 'two',
      }),
    ];

    first.setSelection(['f']);
    first.copy();
    second.paste();

    const { shapes } = second.getBoard();
    const child = shapes.find((shape) => shape.kind === 'rectangle');
    expect(child?.parentId).not.toBeNull();
    expect(shapes.find((shape) => shape.id === child?.parentId)?.kind).toBe(
      'frame'
    );

    for (const relay of relays) {
      relay.close();
    }
  });

  it('re-roots a child whose parent was not copied', () => {
    const channel = sharedChannel();
    const first = createEditor(
      board([frame(), rectangle({ id: 'm', parentId: 'f', x: 20, y: 20 })])
    );
    const second = createEditor(board([]));
    const relays = [
      createClipboardRelay({
        boardId: 'board-1',
        channel,
        editor: first,
        origin: 'one',
      }),
      createClipboardRelay({
        boardId: 'board-1',
        channel,
        editor: second,
        origin: 'two',
      }),
    ];

    first.setSelection(['m']);
    first.copy();
    second.paste();

    expect(second.getBoard().shapes[0]?.parentId).toBeNull();

    for (const relay of relays) {
      relay.close();
    }
  });

  it('ignores a fragment from another build instead of guessing at its fields', () => {
    const channel = sharedChannel();
    const first = createEditor(board([rectangle({ id: 'a', x: 80, y: 80 })]));
    const second = createEditor(board([]));
    const relays = [
      createClipboardRelay({
        boardId: 'board-1',
        channel,
        editor: first,
        origin: 'one',
      }),
      createClipboardRelay({
        boardId: 'board-1',
        channel,
        editor: second,
        origin: 'two',
      }),
    ];
    const message = clipboardMessage(
      { shapes: [rectangle({ id: 'a', x: 80, y: 80 })] },
      { boardId: 'board-1', origin: 'one' }
    );

    channel.post({ ...message, schemaVersion: SCHEMA_VERSION - 1 });
    second.paste();

    expect(second.getBoard().shapes).toEqual([]);

    for (const relay of relays) {
      relay.close();
    }
  });

  it('refuses another board’s fragment, so the wrong board is never pasted into', () => {
    const channel = sharedChannel();
    const first = createEditor(board([rectangle({ id: 'a', x: 80, y: 80 })]));
    const second = createEditor(board([]));
    const relays = [
      createClipboardRelay({
        boardId: 'board-two',
        channel,
        editor: first,
        origin: 'one',
      }),
      createClipboardRelay({
        boardId: 'board-one',
        channel,
        editor: second,
        origin: 'two',
      }),
    ];

    first.setSelection(['a']);
    first.copy();
    second.paste();

    expect(second.getBoard().shapes).toEqual([]);

    for (const relay of relays) {
      relay.close();
    }
  });

  it('validates the board a message names before handing over its shapes', () => {
    const message = clipboardMessage(
      { shapes: [rectangle({ id: 'a', x: 80, y: 80 })] },
      { boardId: 'board-1', origin: 'one' }
    );
    const { boardId: _boardId, ...withoutBoard } = message;

    expect(readClipboardMessage(message, 'board-1')).not.toBeNull();
    expect(readClipboardMessage(message, 'board-2')).toBeNull();
    expect(readClipboardMessage(withoutBoard, 'board-1')).toBeNull();
  });

  it('is not mistaken for presence, so the two-tab handshake still yields', () => {
    const channel = sharedChannel();
    const shapes = Array.from({ length: 100 }, (_, index) =>
      rectangle({ id: `a-${index}`, x: index * 10 })
    );
    const first = createEditor(board(shapes));
    const second = createEditor(board([]));
    const presence = createPresence({
      channel,
      self: { id: 'second', openedAt: 2 },
    });
    createPresence({ channel, self: { id: 'first', openedAt: 1 } });
    const relays = [
      createClipboardRelay({
        boardId: 'board-1',
        channel,
        editor: first,
        origin: 'one',
      }),
      createClipboardRelay({
        boardId: 'board-1',
        channel,
        editor: second,
        origin: 'two',
      }),
    ];

    first.setSelection(shapes.map((shape) => shape.id));
    first.copy();

    expect(presence.isPrimary()).toBe(false);
    expect(presence.leader()).toBe('first');

    for (const relay of relays) {
      relay.close();
    }
  });
});
