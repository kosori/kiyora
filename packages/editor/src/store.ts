import type { Board, Camera, Style } from '@kiyora/model';
import { type Placement, shapeFromPlacement } from './placement';
import { DEFAULT_STYLE, isFigureTool, type Tool } from './tools';

/**
 * Display state: where the board is looked at from, and what the pointer does.
 * It lives beside the document rather than in it, so navigating is never a
 * change to the board, never a history entry, and never a save.
 */
export type View = {
  camera: Camera;
  tool: Tool;
};

/**
 * The engine: it holds one board and its view, and publishes each change to its
 * own subscribers. Nothing here touches the DOM, so a gesture, a command or a
 * migration is proven without a browser.
 */
export type Editor = {
  /** The board as it stands. The same reference until something changes it. */
  getBoard: () => Board;
  /** Replaces the board and notifies every board subscriber. */
  setBoard: (board: Board) => void;
  /** Where the board is looked at from, and what the pointer does. */
  getView: () => View;
  /** The active tool: `getView().tool`, for a surface that only reads the tool. */
  getTool: () => Tool;
  /** Moves the view. The board and the board's subscribers are untouched. */
  setCamera: (camera: Camera) => void;
  /** Changes what the pointer does. The board's subscribers are untouched. */
  setTool: (tool: Tool) => void;
  /** The style the next shape wears: the last used one, or the default. */
  getStyle: () => Style;
  /**
   * Records the style the next shape wears, so the picker's default and the
   * next shape read one value. Nothing observes it yet — the inspector brings
   * the subscription it needs when it lands.
   */
  setStyle: (style: Style) => void;
  /**
   * Places the active tool's shape in `placement`'s box, wearing the last used
   * style, and returns the tool to select. With a tool that places nothing —
   * select or hand — it does nothing.
   */
  placeShape: (placement: Placement) => void;
  /** Subscribes to board changes. Returns the unsubscribe. */
  subscribe: (listener: () => void) => () => void;
  /** Subscribes to view changes. Returns the unsubscribe. */
  subscribeView: (listener: () => void) => () => void;
};

/** An engine over `board`, holding it and publishing each replacement. */
export const createEditor = (board: Board): Editor => {
  let current = board;
  let view: View = { camera: board.camera, tool: 'select' };
  let style: Style = DEFAULT_STYLE;
  const listeners = new Set<() => void>();
  const viewListeners = new Set<() => void>();

  const publish = (set: Set<() => void>): void => {
    for (const listener of set) {
      listener();
    }
  };

  const setView = (next: View): void => {
    view = next;
    publish(viewListeners);
  };

  return {
    getBoard: () => current,
    getStyle: () => style,
    getTool: () => view.tool,
    getView: () => view,
    placeShape: (placement) => {
      const { tool } = view;
      if (!isFigureTool(tool)) {
        return;
      }
      const shape = shapeFromPlacement(tool, placement, style, current.shapes);
      current = { ...current, shapes: [...current.shapes, shape] };
      setView({ ...view, tool: 'select' });
      publish(listeners);
    },
    setBoard: (next) => {
      current = next;
      publish(listeners);
    },
    setCamera: (camera) => {
      setView({ ...view, camera });
    },
    setStyle: (next) => {
      style = next;
    },
    setTool: (tool) => {
      setView({ ...view, tool });
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    subscribeView: (listener) => {
      viewListeners.add(listener);
      return () => {
        viewListeners.delete(listener);
      };
    },
  };
};
