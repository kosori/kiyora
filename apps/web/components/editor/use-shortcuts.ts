'use client';

import {
  CAMERA_ACTIONS,
  type CameraAction,
  type CommandHost,
  matchKey,
  resolveKey,
  runCommand,
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
 * The one module that listens for keys. Every window keydown is resolved
 * through the keymap and handed to the dispatch, so the bindings, the dialog
 * and the one execution path cannot drift; the keymap decides the modifiers and
 * whether the browser must not act on the chord too, and a camera key reaches
 * the surface through the host, which owns the pointer anchor. A nudge runs
 * through the same dispatch: the keymap says a shifted arrow is coarse, the
 * dispatch turns that into a step.
 *
 * The same listener serves presenting: the chord carries the mode the board is
 * in, so the keymap hands back a presenting command while a slide is up and the
 * editing bindings behind it stay unrun.
 */
export const useShortcuts = (
  onShowShortcuts: () => void,
  camera: CameraIntent,
  onOpenFind: () => void
): void => {
  const editor = useEditor();

  useEffect(() => {
    const host: CommandHost = {
      camera: camera.run,
      openFind: onOpenFind,
      showShortcuts: onShowShortcuts,
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (isTyping(event.target)) {
        return;
      }

      const binding = matchKey({
        alt: event.altKey,
        command: event.metaKey || event.ctrlKey,
        key: event.key,
        mode: editor.getPresent().active ? 'present' : 'edit',
        shift: event.shiftKey,
      });
      if (binding === null) {
        return;
      }

      if (binding.preventDefault === true) {
        event.preventDefault();
      }
      runCommand(binding.command, { editor, host });
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
  }, [camera, editor, onOpenFind, onShowShortcuts]);
};
