'use client';

import {
  CAMERA_ACTIONS,
  type CameraAction,
  GRID,
  NUDGE_STEP,
  resolveKey,
} from '@kiyora/editor';
import { useEditor } from '@kiyora/editor/react';
import { useEffect } from 'react';

const TYPING = ['INPUT', 'SELECT', 'TEXTAREA'];

/**
 * What the camera does for a resolved camera key. The keymap says *what* a key
 * does; the surface knows *where* the pointer is, so the anchor stays there.
 */
export type CameraIntent = {
  /** Runs a camera action. `pan` opens on keydown and closes on keyup. */
  run: (action: CameraAction, phase: 'down' | 'up') => void;
};

const isTyping = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable || TYPING.includes(target.tagName));

/**
 * The one module that listens for keys. Every window keydown and keyup is
 * resolved through the keymap, so the bindings and the reference cannot drift;
 * the keymap decides the modifiers, and a camera key is handed to the surface,
 * which owns the pointer anchor. A nudge runs its step here: the keymap says a
 * shifted arrow is coarse, the grid says how far that is.
 *
 * The same listener serves presenting: the chord carries the mode the board is
 * in, so the keymap hands back a presenting command while a slide is up and the
 * editing bindings behind it stay unrun.
 */
export const useShortcuts = (
  onShowShortcuts: () => void,
  camera: CameraIntent
): void => {
  const editor = useEditor();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTyping(event.target)) {
        return;
      }

      const command = resolveKey({
        alt: event.altKey,
        command: event.metaKey || event.ctrlKey,
        key: event.key,
        mode: editor.getPresent().active ? 'present' : 'edit',
        shift: event.shiftKey,
      });
      if (command === null) {
        return;
      }

      if (command.kind === 'tool') {
        editor.setTool(command.tool);
        return;
      }

      if (command.kind === 'camera') {
        event.preventDefault();
        camera.run(command.action, 'down');
        return;
      }

      if (command.kind === 'nudge') {
        event.preventDefault();
        const step = command.coarse ? GRID : NUDGE_STEP;
        editor.nudge(command.dx * step, command.dy * step);
        return;
      }

      if (command.kind === 'cancel-gesture') {
        editor.cancelGesture();
        return;
      }

      if (command.kind === 'delete') {
        event.preventDefault();
        editor.deleteSelection();
        return;
      }

      if (command.kind === 'duplicate') {
        event.preventDefault();
        editor.duplicate();
        return;
      }

      if (command.kind === 'group') {
        event.preventDefault();
        editor.groupSelection();
        return;
      }

      if (command.kind === 'ungroup') {
        event.preventDefault();
        editor.ungroupSelection();
        return;
      }

      if (command.kind === 'copy') {
        event.preventDefault();
        editor.copy();
        return;
      }

      if (command.kind === 'cut') {
        event.preventDefault();
        editor.cut();
        return;
      }

      if (command.kind === 'paste') {
        event.preventDefault();
        editor.paste();
        return;
      }

      if (command.kind === 'undo') {
        event.preventDefault();
        editor.undo();
        return;
      }

      if (command.kind === 'redo') {
        event.preventDefault();
        editor.redo();
        return;
      }

      if (command.kind === 'present') {
        editor.startPresent();
        return;
      }

      if (command.kind === 'present-next') {
        event.preventDefault();
        editor.nextSlide();
        return;
      }

      if (command.kind === 'present-previous') {
        event.preventDefault();
        editor.previousSlide();
        return;
      }

      if (command.kind === 'present-exit') {
        event.preventDefault();
        editor.stopPresent();
        return;
      }

      if (command.kind === 'present-notes') {
        editor.toggleNotes();
        return;
      }

      if (command.kind === 'present-timer') {
        editor.toggleTimer();
        return;
      }

      onShowShortcuts();
    };

    const onKeyUp = (event: KeyboardEvent) => {
      const command = resolveKey({
        alt: event.altKey,
        command: event.metaKey || event.ctrlKey,
        key: event.key,
        mode: editor.getPresent().active ? 'present' : 'edit',
        shift: event.shiftKey,
      });
      if (command?.kind === 'nudge') {
        editor.endNudgeRun();
        return;
      }
      if (command?.kind === 'camera') {
        camera.run(command.action, 'up');
      }
    };

    /** A lost focus is a lost keyup; releasing here keeps a held key from sticking. */
    const onBlur = () => {
      for (const action of CAMERA_ACTIONS) {
        camera.run(action, 'up');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [editor, onShowShortcuts, camera]);
};
