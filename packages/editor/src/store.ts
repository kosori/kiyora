import type { Board } from '@kiyora/model';
import { createBoardCommands } from './board-commands';
import { createDeckCommands } from './deck-commands';
import { createEditCommands } from './edit-commands';
import { createGestures } from './gestures';
import { createLabelEdit } from './label-edit';
import { createPresent } from './present';
import type { Editor } from './state';
import { createStoreCore } from './store-core';

export type { Drag, Editor, Gesture, PresentState, View } from './state';

/**
 * An engine over `board`, holding it and publishing each replacement. This file
 * only composes: the core owns the state and the write funnel, the gestures own
 * the pointer, and each command factory owns one concern, so no one module
 * carries the whole surface.
 */
export const createEditor = (board: Board): Editor => {
  const core = createStoreCore(board);
  const gestures = createGestures(core);
  const present = createPresent(() => core.board());
  const deck = createDeckCommands({
    board: core.board,
    change: core.change,
    style: core.style,
  });
  const commands = createEditCommands({
    board: core.board,
    change: core.change,
    select: core.select,
    selection: core.selection,
  });
  const label = createLabelEdit({
    board: core.board,
    change: core.change,
    publish: core.publish,
    transactions: core.transactions,
  });
  const edits = createBoardCommands({ core, gestures, label });

  return {
    addSlide: deck.addSlide,
    addSlideFromTemplate: deck.addSlideFromTemplate,
    beginTextEdit: label.begin,
    cancelGesture: gestures.cancelGesture,
    cancelTextEdit: edits.cancelTextEdit,
    copy: commands.copy,
    cut: commands.cut,
    deleteSelection: commands.deleteSelection,
    deleteSlide: deck.deleteSlide,
    duplicate: commands.duplicate,
    duplicateSlide: deck.duplicateSlide,
    endNudgeRun: core.transactions.endNudgeRun,
    endTextEdit: label.end,
    getBoard: core.board,
    getGesture: gestures.getGesture,
    getHistory: core.getHistory,
    getPresent: present.getState,
    getSelection: core.selection,
    getStyle: core.style,
    getTool: () => core.view().tool,
    getView: core.view,
    moveSlide: deck.moveSlide,
    nextSlide: present.next,
    nudge: edits.nudge,
    paste: commands.paste,
    placeShape: edits.placeShape,
    pointerDown: gestures.pointerDown,
    pointerMove: gestures.pointerMove,
    pointerUp: gestures.pointerUp,
    previousSlide: present.previous,
    redo: edits.redo,
    restyle: edits.restyle,
    setBoard: edits.setBoard,
    setCamera: (camera) => {
      core.setView({ ...core.view(), camera });
    },
    setConnector: edits.setConnector,
    setSelection: core.select,
    setSlideNotes: deck.setSlideNotes,
    setStyle: core.setStyle,
    setText: label.setText,
    setTextStyle: label.setTextStyle,
    setTool: (tool) => {
      core.setView({ ...core.view(), tool });
    },
    startPresent: present.start,
    stopPresent: present.stop,
    subscribe: core.subscribe,
    subscribeGesture: gestures.subscribeGesture,
    subscribeHistory: core.subscribeHistory,
    subscribePresent: present.subscribe,
    subscribeSelection: core.subscribeSelection,
    subscribeView: core.subscribeView,
    toggleNotes: present.toggleNotes,
    toggleSlideSkip: deck.toggleSlideSkip,
    toggleTimer: present.toggleTimer,
    undo: edits.undo,
  };
};
