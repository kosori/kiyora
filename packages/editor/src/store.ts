import type { Board, Style } from '@kiyora/model';
import { type Placement, shapeFromPlacement } from './placement';
import { DEFAULT_STYLE, type Tool } from './tools';

/**
 * The engine: it holds one board and publishes every change to its
 * subscribers. Nothing here touches the DOM, so a gesture, a command or a
 * migration is proven without a browser.
 */
export type Editor = {
  /** The board as it stands. The same reference until something changes it. */
  getBoard: () => Board;
  /** Replaces the board and notifies every subscriber. */
  setBoard: (board: Board) => void;
  /** Subscribes to changes of any kind. Returns the unsubscribe. */
  subscribe: (listener: () => void) => () => void;
  /** The active tool. */
  getTool: () => Tool;
  /** Makes `tool` active and notifies. */
  setTool: (tool: Tool) => void;
  /** The style the next shape wears: the last used one, or the default. */
  getStyle: () => Style;
  /** Records the style the next shape wears. The inspector's and the picker's seam. */
  setStyle: (style: Style) => void;
  /**
   * Places the active tool's shape in `placement`'s box, wearing the last used
   * style, and returns the tool to select. With the select tool it does nothing.
   */
  placeShape: (placement: Placement) => void;
};

/** An engine over `board`, holding it and publishing each replacement. */
export const createEditor = (board: Board): Editor => {
  let current = board;
  let tool: Tool = 'select';
  let style: Style = DEFAULT_STYLE;
  const listeners = new Set<() => void>();

  const publish = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  return {
    getBoard: () => current,
    getStyle: () => style,
    getTool: () => tool,
    placeShape: (placement) => {
      const kind = tool;
      if (kind === 'select') {
        return;
      }
      const shape = shapeFromPlacement(kind, placement, style, current.shapes);
      current = { ...current, shapes: [...current.shapes, shape] };
      tool = 'select';
      publish();
    },
    setBoard: (next) => {
      current = next;
      publish();
    },
    setStyle: (next) => {
      style = next;
      publish();
    },
    setTool: (next) => {
      tool = next;
      publish();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};
