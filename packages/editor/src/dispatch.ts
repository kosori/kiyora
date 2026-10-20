import type { CameraAction, Command } from './commands';
import { GRID, NUDGE_STEP } from './geometry/snap';
import type { Editor } from './state';

/**
 * The effects a command needs that are not board mutations, because the app
 * owns them: the camera looks through a surface that knows where the pointer
 * is, and the shortcut sheet is chrome. The dispatch calls them too, so a
 * command has one execution path whether the engine or the app does the work.
 */
export type CommandHost = {
  /** Runs a camera action. `pan` opens on keydown and closes on keyup. */
  camera: (action: CameraAction, phase: 'down' | 'up') => void;
  /** Opens the keyboard shortcut reference. */
  showShortcuts: () => void;
};

/** What running a command takes: the engine, and the effects the app owns. */
export type CommandTarget = {
  editor: Editor;
  host: CommandHost;
};

/**
 * One command kind's execution. The command arrives narrowed to its own kind,
 * so a handler reads its own fields without a second check.
 */
type Handler<K extends Command['kind']> = (
  target: CommandTarget,
  command: Extract<Command, { kind: K }>
) => void;

/**
 * One handler per command kind. Being a mapped type, it cannot be written
 * without a path for a kind that exists, so a new command fails to compile
 * before it fails to run.
 */
type Handlers = { readonly [K in Command['kind']]: Handler<K> };

/** Every command, and the one place each kind is executed. */
const HANDLERS: Handlers = {
  camera: ({ host }, command) => host.camera(command.action, 'down'),
  'cancel-gesture': ({ editor }) => editor.cancelGesture(),
  copy: ({ editor }) => editor.copy(),
  cut: ({ editor }) => editor.cut(),
  delete: ({ editor }) => editor.deleteSelection(),
  duplicate: ({ editor }) => editor.duplicate(),
  nudge: ({ editor }, command) => {
    const step = command.coarse ? GRID : NUDGE_STEP;
    editor.nudge(command.dx * step, command.dy * step);
  },
  paste: ({ editor }) => editor.paste(),
  present: ({ editor }) => editor.startPresent(),
  'present-exit': ({ editor }) => editor.stopPresent(),
  'present-next': ({ editor }) => editor.nextSlide(),
  'present-notes': ({ editor }) => editor.toggleNotes(),
  'present-previous': ({ editor }) => editor.previousSlide(),
  'present-timer': ({ editor }) => editor.toggleTimer(),
  redo: ({ editor }) => editor.redo(),
  'show-shortcuts': ({ host }) => host.showShortcuts(),
  tool: ({ editor }, command) => editor.setTool(command.tool),
  undo: ({ editor }) => editor.undo(),
};

/**
 * Every command kind the dispatch runs, read from the handler table rather
 * than written out again, so the keymap test compares two independent sources:
 * what a key can produce, and what this module can execute.
 */
export const DISPATCHED_KINDS: readonly Command['kind'][] = Object.keys(
  HANDLERS
) as Command['kind'][];

/** Hands one command to the handler declared for its own kind, and no other. */
const execute = <K extends Command['kind']>(
  kind: K,
  target: CommandTarget,
  command: Extract<Command, { kind: K }>
): void => {
  HANDLERS[kind](target, command);
};

/**
 * Runs `command`: the one way a command executes. The keyboard calls it, and a
 * palette or a context menu will call it too, so no surface can grow a second
 * copy of what a command does.
 */
export const runCommand = (command: Command, target: CommandTarget): void => {
  execute(command.kind, target, command);
};
