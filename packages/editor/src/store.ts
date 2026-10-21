import type { Board } from '@kiyora/model';
import { createArrangeCommands } from './arrange-commands';
import { createBoardCommands } from './board-commands';
import { createDeckCommands } from './deck-commands';
import { createEditCommands } from './edit-commands';
import { createGestures } from './gestures';
import { createLabelEdit } from './label-edit';
import { createPresent } from './present';
import { createSourceCommands } from './source-commands';
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
  const arrange = createArrangeCommands({
    board: core.board,
    change: core.change,
    selection: core.selection,
  });
  const label = createLabelEdit({
    board: core.board,
    change: core.change,
    publish: core.publish,
    transactions: core.transactions,
  });
  const edits = createBoardCommands({ core, gestures, label });
  const source = createSourceCommands(core);

  return {
    addSlide: deck.addSlide,
    addSlideFromTemplate: deck.addSlideFromTemplate,
    align: arrange.align,
    applySource: source.applySource,
    beginTextEdit: label.begin,
    bringForward: () => edits.reorder('forward'),
    bringToFront: () => edits.reorder('front'),
    cancelGesture: gestures.cancelGesture,
    cancelTextEdit: edits.cancelTextEdit,
    canPaste: commands.canPaste,
    copy: commands.copy,
    cut: commands.cut,
    deleteSelection: commands.deleteSelection,
    deleteSlide: deck.deleteSlide,
    distribute: arrange.distribute,
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
    groupSelection: commands.groupSelection,
    moveSlide: deck.moveSlide,
    nextSlide: present.next,
    nudge: edits.nudge,
    paste: commands.paste,
    placeShape: edits.placeShape,
    pointerDown: gestures.pointerDown,
    pointerMove: gestures.pointerMove,
    pointerUp: gestures.pointerUp,
    previousSlide: present.previous,
    receiveClipboard: commands.receiveClipboard,
    redo: edits.redo,
    restyle: edits.restyle,
    sendBackward: () => edits.reorder('backward'),
    sendToBack: () => edits.reorder('back'),
    setBoard: edits.setBoard,
    setCamera: (camera) => {
      core.setView({ ...core.view(), camera });
    },
    setConnector: edits.setConnector,
    setLocked: edits.setLocked,
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
    subscribeClipboard: commands.subscribeClipboard,
    subscribeGesture: gestures.subscribeGesture,
    subscribeHistory: core.subscribeHistory,
    subscribePresent: present.subscribe,
    subscribeSelection: core.subscribeSelection,
    subscribeView: core.subscribeView,
    toggleNotes: present.toggleNotes,
    toggleSlideSkip: deck.toggleSlideSkip,
    toggleTimer: present.toggleTimer,
    undo: edits.undo,
    ungroupSelection: commands.ungroupSelection,
  };
};
