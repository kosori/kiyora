import type { Board } from '@kiyora/model';
import { createArrangeCommands } from './arrange-commands';
import { createBoardCommands } from './board-commands';
import { createDeckCommands } from './deck-commands';
import { createEditCommands } from './edit-commands';
import { createGestures } from './gestures';
import { createLabelEdit } from './label-edit';
import { nextShape } from './navigation';
import { createPresent } from './present';
import { createSourceCommands } from './source-commands';
import type { Editor } from './state';
import { createStoreCore } from './store-core';
import { createTableEdit } from './table-edit';

export type { ImagePlacement } from './placement';
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
  const table = createTableEdit({
    board: core.board,
    change: core.change,
    publish: core.publish,
    transactions: core.transactions,
  });

  return {
    addSlide: deck.addSlide,
    addSlideFromTemplate: deck.addSlideFromTemplate,
    addTableColumn: table.addColumn,
    addTableRow: table.addRow,
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
    navigate: (direction) => {
      const next = nextShape(core.board(), core.selection(), direction);
      if (next !== null) {
        core.select([next.id]);
      }
    },
    nextSlide: present.next,
    nudge: edits.nudge,
    paste: commands.paste,
    placeImage: edits.placeImage,
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
    setChart: edits.setChart,
    setConnector: edits.setConnector,
    setIcon: (name) => {
      core.setView({ ...core.view(), icon: name, tool: 'icon' });
    },
    setLocked: edits.setLocked,
    setNavigating: (navigating) => {
      core.setView({ ...core.view(), navigating });
    },
    setSelection: core.select,
    setSlideNotes: deck.setSlideNotes,
    setStyle: core.setStyle,
    setTableCell: table.setCell,
    setTableHeader: table.setHeader,
    setText: label.setText,
    setTextStyle: label.setTextStyle,
    setTheme: edits.setTheme,
    setTitle: edits.setTitle,
    setTool: (tool) => {
      core.setView({ ...core.view(), icon: null, tool });
    },
    setZen: (zen) => {
      core.setView({ ...core.view(), zen });
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
