'use client';

import { toScreen } from '@kiyora/editor';
import { useBoard, useEditor, useView } from '@kiyora/editor/react';
import {
  CODE_FONT_FAMILY,
  caretInCode,
  connectorLabelPoint,
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
  SyntheticEvent as ReactSyntheticEvent,
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
 * the canvas rather than in a dialog. It holds the draft locally, opens the
 * store's edit transaction when it appears, and lands the whole label in one
 * store change on blur, so finishing an edit is one undo — not one per keystroke.
 * Escape cancels the edit, restoring the words the shape had before it opened.
 */
export const TextEditor = ({ shapeId, onDone, measure }: Props) => {
  const editor = useEditor();
  const board = useBoard();
  const { camera } = useView();
  const shape = board.shapes.find((item) => item.id === shapeId);
  const [value, setValue] = useState(shape?.text ?? '');
  const [caret, setCaret] = useState(value.length);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    editor.beginTextEdit();
  }, [editor]);

  useEffect(() => {
    const element = input.current;
    if (element === null) {
      return;
    }
    element.focus();
    element.setSelectionRange(element.value.length, element.value.length);
  }, []);

  /**
   * Lands the draft as one board change and closes the edit's transaction, so a
   * finished edit is one undo — the box a sticky grew into travels with the
   * words, so the note shrinks back too.
   */
  const commit = useCallback(() => {
    editor.setText(shapeId, value, measure);
    editor.endTextEdit();
    onDone();
  }, [editor, measure, onDone, shapeId, value]);

  /** Escape: the board goes back to the words it had, and nothing is pushed. */
  const cancel = useCallback(() => {
    editor.cancelTextEdit();
    onDone();
  }, [editor, onDone]);

  const onChange = useCallback(
    (event: ReactChangeEvent<HTMLTextAreaElement>) => {
      setValue(event.target.value);
      setCaret(event.target.selectionStart);
    },
    []
  );

  /** Tracks the caret across a click, a key or a selection, so code is set in its face. */
  const trackCaret = useCallback(
    (event: ReactSyntheticEvent<HTMLTextAreaElement>) => {
      setCaret(event.currentTarget.selectionStart);
    },
    []
  );

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        cancel();
      }
    },
    [cancel]
  );

  if (shape === undefined) {
    return null;
  }

  const style = shape.textStyle ?? DEFAULT_TEXT_STYLE;
  const label = shape.kind === 'connector';
  const box =
    shape.kind === 'sticky'
      ? fitSticky({ ...shape, text: value }, measure)
      : shape;
  const at = label
    ? toScreen(camera, connectorLabelPoint(shape, board.shapes))
    : toScreen(camera, { x: box.x, y: box.y });
  const width = (label ? 160 : box.w) * camera.zoom;
  const height =
    (label ? style.size * TEXT_LINE_HEIGHT + TEXT_PADDING : box.h) *
    camera.zoom;

  return (
    <textarea
      aria-label='Label'
      className='absolute z-20 resize-none rounded-sm border border-primary bg-background/95 text-foreground shadow-sm outline-none'
      data-testid='text-editor'
      onBlur={commit}
      onChange={onChange}
      onClick={trackCaret}
      onKeyDown={onKeyDown}
      onKeyUp={trackCaret}
      onSelect={trackCaret}
      ref={input}
      style={{
        fontFamily: caretInCode(value, caret)
          ? CODE_FONT_FAMILY
          : TEXT_FONT_FAMILY,
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
