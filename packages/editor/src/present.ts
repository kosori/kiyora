import { type Board, presentedSlides } from '@kiyora/model';
import type { PresentState } from './state';

/** The presentation slice: its state, its own subscribers, and no board writes. */
export type Present = {
  getState: () => PresentState;
  next: () => void;
  previous: () => void;
  start: () => void;
  stop: () => void;
  subscribe: (listener: () => void) => () => void;
  toggleNotes: () => void;
  toggleTimer: () => void;
};

/** Nothing is playing, both overlays are up by default. */
const IDLE: PresentState = {
  active: false,
  index: 0,
  notes: true,
  timer: true,
};

/**
 * The presentation behind the editor. It reads the board's deck through `board`
 * to know which slides play, but it never writes the board: starting, stepping
 * and leaving a slide show leave no history entry and arm no save. Its
 * subscribers are its own, so the canvas and the autosave never wake for it.
 */
export const createPresent = (board: () => Board): Present => {
  let state = IDLE;
  const listeners = new Set<() => void>();

  const publish = (next: PresentState): void => {
    state = next;
    for (const listener of listeners) {
      listener();
    }
  };

  return {
    getState: () => state,
    next: () => {
      if (!state.active) {
        return;
      }
      const last = presentedSlides(board()).length - 1;
      const index = Math.max(0, Math.min(state.index + 1, last));
      if (index !== state.index) {
        publish({ ...state, index });
      }
    },
    previous: () => {
      if (!state.active) {
        return;
      }
      const index = Math.max(state.index - 1, 0);
      if (index !== state.index) {
        publish({ ...state, index });
      }
    },
    start: () => {
      if (presentedSlides(board()).length === 0) {
        return;
      }
      publish({ active: true, index: 0, notes: true, timer: true });
    },
    stop: () => {
      if (!state.active) {
        return;
      }
      publish(IDLE);
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    toggleNotes: () => {
      if (state.active) {
        publish({ ...state, notes: !state.notes });
      }
    },
    toggleTimer: () => {
      if (state.active) {
        publish({ ...state, timer: !state.timer });
      }
    },
  };
};
