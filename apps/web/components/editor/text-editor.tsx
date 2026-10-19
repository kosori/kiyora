'use client';

import { toScreen } from '@kiyora/editor';
import { useBoard, useEditor, useView } from '@kiyora/editor/react';
import {
  connectorLabelPoint,
  DEFAULT_TEXT_STYLE,
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
};

/**
 * The label edit surface: a textarea sitting exactly where the words will be, on
 * the canvas rather than in a dialog. It holds the draft locally and commits the
 * whole label in one store change on blur or Escape, so finishing an edit is one
 * commit — one undo, once history lands — not one per keystroke.
 */
export const TextEditor = ({ shapeId, onDone }: Props) => {
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
    editor.setText(shapeId, value);
    onDone();
  }, [editor, onDone, shapeId, value]);

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
  const label = shape.kind === 'connector';
  const at = label
    ? toScreen(camera, connectorLabelPoint(shape, board.shapes))
    : toScreen(camera, { x: shape.x, y: shape.y });
  const width = (label ? 160 : shape.w) * camera.zoom;
  const height =
    (label ? style.size * TEXT_LINE_HEIGHT + TEXT_PADDING : shape.h) *
    camera.zoom;

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
        height,
        left: label ? at.x - width / 2 : at.x,
        lineHeight: TEXT_LINE_HEIGHT,
        padding: TEXT_PADDING * camera.zoom,
        textAlign: label ? 'center' : style.align,
        top: label ? at.y - height / 2 : at.y,
        width,
      }}
      value={value}
    />
  );
};
