'use client';

import { CAMERA_ACTIONS, type CameraAction, resolveKey } from '@kiyora/editor';
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
 * a camera key is handed to the surface, which owns the pointer anchor.
 */
export const useShortcuts = (
  onShowShortcuts: () => void,
  camera: CameraIntent
): void => {
  const editor = useEditor();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        isTyping(event.target)
      ) {
        return;
      }

      const command = resolveKey(event.key);
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

      onShowShortcuts();
    };

    const onKeyUp = (event: KeyboardEvent) => {
      const command = resolveKey(event.key);
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
