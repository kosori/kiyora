import type { Alignment, DistributeAxis } from './align';
import type { Tool } from './tools';

/**
 * Every camera action the surface honours, and the source of the `CameraAction`
 * union: a test walks this list, so an action added to the surface without a key
 * and a reference row fails rather than quietly working behind the dialog's back.
 */
export const CAMERA_ACTIONS = ['pan', 'zoom-in', 'zoom-out'] as const;

/** What a camera key does. The surface supplies the anchor; the keymap supplies the action. */
export type CameraAction = (typeof CAMERA_ACTIONS)[number];

/**
 * A command a key runs. The union lives beside its binder rather than inside the
 * keymap file only so the vocabulary and the bindings each stay inside the size
 * budget as cut 1 adds to both; there is still one union and one dispatch.
 */
export type Command =
  | { kind: 'tool'; tool: Tool }
  | { kind: 'show-shortcuts' }
  | { kind: 'palette' }
  | { kind: 'camera'; action: CameraAction }
  | { kind: 'nudge'; dx: number; dy: number; coarse: boolean }
  | { kind: 'cancel-gesture' }
  | { kind: 'delete' }
  | { kind: 'copy' }
  | { kind: 'cut' }
  | { kind: 'paste' }
  | { kind: 'duplicate' }
  | { kind: 'find' }
  | { kind: 'group' }
  | { kind: 'ungroup' }
  | { kind: 'bring-to-front' }
  | { kind: 'send-to-back' }
  | { kind: 'bring-forward' }
  | { kind: 'send-backward' }
  | { kind: 'align'; alignment: Alignment }
  | { kind: 'distribute'; axis: DistributeAxis }
  | { kind: 'undo' }
  | { kind: 'redo' }
  | { kind: 'present' }
  | { kind: 'present-next' }
  | { kind: 'present-previous' }
  | { kind: 'present-exit' }
  | { kind: 'present-notes' }
  | { kind: 'present-timer' };

/** A stable name for a command, so the keymap and the reference can join. */
export const commandId = (command: Command): string => {
  if (command.kind === 'tool') {
    return `tool.${command.tool}`;
  }
  if (command.kind === 'camera') {
    return `camera.${command.action}`;
  }
  if (command.kind === 'nudge') {
    return `nudge.${command.dx}.${command.dy}.${command.coarse ? 'coarse' : 'fine'}`;
  }
  if (command.kind === 'align') {
    return `align.${command.alignment}`;
  }
  if (command.kind === 'distribute') {
    return `distribute.${command.axis}`;
  }
  return command.kind;
};
