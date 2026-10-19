'use client';

import { toScreen } from '@kiyora/editor';
import { useBoard, useEditor, useView } from '@kiyora/editor/react';
import {
  DEFAULT_TEXT_STYLE,
  fitSticky,
  type Measurer,
  TEXT_FONT_FAMILY,
  TEXT_LINE_HEIGHT,
  TEXT_PADDING,
} from '@kiyora/model';
import type {
  ChangeEvent as ReactChangeEvent,
  KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

type Props = {
  /** The shape whose label is being edited. */
  shapeId: string;
  /** Called when the edit finishes, so the overlay can close. */
  onDone: () => void;
  /** The app's measurer, so a sticky grows to match the words it is given. */
  measure: Measurer;
};

/**
 * The label edit surface: a textarea sitting exactly where the words will be, on
 * the canvas rather than in a dialog. It holds the draft locally and commits the
 * whole label in one store change on blur or Escape, so finishing an edit is one
 * commit — one undo, once history lands — not one per keystroke.
 */
export const TextEditor = ({ shapeId, onDone, measure }: Props) => {
  const editor = useEditor();
  const board = useBoard();
  const { camera } = useView();
  const shape = board.shapes.find((item) => item.id === shapeId);
  const [value, setValue] = useState(shape?.text ?? '');
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const element = input.current;
    if (element === null) {
      return;
    }
    element.focus();
    element.setSelectionRange(element.value.length, element.value.length);
  }, []);

  const commit = useCallback(() => {
    editor.setText(shapeId, value, measure);
    onDone();
  }, [editor, measure, onDone, shapeId, value]);

  const onChange = useCallback(
    (event: ReactChangeEvent<HTMLTextAreaElement>) => {
      setValue(event.target.value);
    },
    []
  );

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        commit();
      }
    },
    [commit]
  );

  if (shape === undefined) {
    return null;
  }

  const style = shape.textStyle ?? DEFAULT_TEXT_STYLE;
  const box =
    shape.kind === 'sticky'
      ? fitSticky({ ...shape, text: value }, measure)
      : shape;
  const at = toScreen(camera, { x: shape.x, y: shape.y });

  return (
    <textarea
      aria-label='Label'
      className='absolute z-20 resize-none rounded-sm border border-primary bg-background/95 text-foreground shadow-sm outline-none'
      data-testid='text-editor'
      onBlur={commit}
      onChange={onChange}
      onKeyDown={onKeyDown}
      ref={input}
      style={{
        fontFamily: TEXT_FONT_FAMILY,
        fontSize: style.size * camera.zoom,
        height: box.h * camera.zoom,
        left: at.x,
        lineHeight: TEXT_LINE_HEIGHT,
        padding: TEXT_PADDING * camera.zoom,
        textAlign: style.align,
        top: at.y,
        width: shape.w * camera.zoom,
      }}
      value={value}
    />
  );
};
