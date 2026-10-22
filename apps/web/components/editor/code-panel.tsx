'use client';

import { parse } from '@kiyora/dsl';
import { sourceState } from '@kiyora/editor';
import { useBoard, useEditor, useSelection } from '@kiyora/editor/react';
import type { Board, FrameShape } from '@kiyora/model';
import {
  type ChangeEvent,
  type KeyboardEvent,
  type MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Button } from '~/components/ui/button';

/** The text a person is typing for one frame, before it is applied. */
type Draft = {
  frameId: string;
  text: string;
};

/**
 * The frame the panel writes to: a selected frame, or the frame whose Source
 * generated one of the selected shapes. Following a generated shape back to
 * its frame is what lets the panel show the frame go stale as the shape is
 * edited, instead of going blank until the frame is selected again.
 */
const selectedFrame = (
  board: Board,
  selection: readonly string[]
): FrameShape | null => {
  const chosen = board.shapes.find(
    (shape) => shape.kind === 'frame' && selection.includes(shape.id)
  );
  if (chosen?.kind === 'frame') {
    return chosen;
  }
  const source = board.shapes.find(
    (shape) =>
      shape.kind === 'frame' &&
      shape.source?.generatedIds.some((id) => selection.includes(id))
  );

  return source?.kind === 'frame' ? source : null;
};

/**
 * The offset where `line` starts, counting from one. A line past the end
 * lands at the end of the text, so a stale diagnostic still focuses it.
 */
const lineStart = (text: string, line: number): number => {
  let offset = 0;
  for (let current = 1; current < line; current += 1) {
    const next = text.indexOf('\n', offset);
    if (next === -1) {
      return text.length;
    }
    offset = next + 1;
  }

  return offset;
};

/**
 * The code panel: the selected Frame's Source, as text. Typing only changes this
 * panel — the board moves when Apply runs, and never before. Applying is one
 * gesture, so one undo takes the stamped shapes back, and the text stays on the
 * frame for the next open. A frame with no Source opens an empty panel.
 *
 * Diagnostics are parsed from the text on screen, while typing, so their line
 * numbers follow edits above them. That parse never writes the board: applying
 * stays the only thing that stamps shapes.
 */
export const CodePanel = () => {
  const editor = useEditor();
  const board = useBoard();
  const selection = useSelection();
  const [draft, setDraft] = useState<Draft | null>(null);
  const frame = selectedFrame(board, selection);
  const value =
    draft !== null && draft.frameId === frame?.id
      ? draft.text
      : (frame?.source?.text ?? '');
  const diagnostics = useMemo(() => parse(value).diagnostics, [value]);
  const sourceRef = useRef<HTMLTextAreaElement>(null);
  const confirmRef = useRef<HTMLDialogElement>(null);
  const [confirming, setConfirming] = useState(false);
  const state = sourceState(frame?.source, value);

  useEffect(() => {
    const element = confirmRef.current;
    if (element === null) {
      return;
    }
    if (confirming && !element.open) {
      element.showModal();
      return;
    }
    if (!confirming) {
      element.close();
    }
  }, [confirming]);

  const reveal = useCallback(
    (line: number) => {
      const textarea = sourceRef.current;
      if (textarea === null) {
        return;
      }
      const caret = lineStart(value, line);
      textarea.focus();
      textarea.setSelectionRange(caret, caret);
    },
    [value]
  );

  const onDiagnostic = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const line = Number(event.currentTarget.dataset.line);
      if (Number.isInteger(line)) {
        reveal(line);
      }
    },
    [reveal]
  );

  const apply = useCallback(
    (force = false) => {
      if (frame === null) {
        return;
      }
      const result = editor.applySource(frame.id, value, { force });
      if (result === 'needs-confirm') {
        setConfirming(true);
        return;
      }
      if (result !== 'applied') {
        return;
      }
      setConfirming(false);
      setDraft(null);
    },
    [editor, frame, value]
  );

  const cancelApply = useCallback(() => {
    setConfirming(false);
  }, []);

  const confirmApply = useCallback(() => {
    apply(true);
  }, [apply]);

  const applyNow = useCallback(() => {
    apply();
  }, [apply]);

  const onChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      if (frame === null) {
        return;
      }
      setDraft({ frameId: frame.id, text: event.target.value });
    },
    [frame]
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key !== 'Enter' || !(event.metaKey || event.ctrlKey)) {
        return;
      }
      event.preventDefault();
      apply();
    },
    [apply]
  );

  return (
    <section
      className='flex h-full min-h-0 flex-col gap-2 overflow-y-auto p-3'
      data-testid='code'
    >
      <h2 className='font-heading font-medium text-sm'>Source</h2>
      {state.pending ? (
        <p
          className='rounded border border-border bg-muted px-2 py-1 text-xs'
          data-testid='code-pending'
        >
          Pending — not applied
        </p>
      ) : null}
      {state.stale ? (
        <p
          className='rounded border border-border px-2 py-1 text-destructive text-xs'
          data-testid='code-stale'
        >
          Stale — generated shapes edited by hand
        </p>
      ) : null}
      {frame === null ? (
        <p className='text-muted-foreground text-xs' data-testid='code-empty'>
          Select a frame to write its source.
        </p>
      ) : null}
      <textarea
        aria-describedby='code-hint'
        aria-label='Source'
        className='min-h-40 flex-1 resize-none rounded border border-border bg-background p-2 font-mono text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50'
        data-testid='code-source'
        disabled={frame === null}
        onChange={onChange}
        onKeyDown={onKeyDown}
        ref={sourceRef}
        spellCheck={false}
        value={value}
      />
      {diagnostics.length > 0 ? (
        <ul
          aria-label='Diagnostics'
          className='flex shrink-0 flex-col gap-1'
          data-testid='code-diagnostics'
        >
          {diagnostics.map((diagnostic, index) => {
            const {
              message,
              severity,
              span: {
                start: { line },
              },
            } = diagnostic;

            return (
              <li key={`${line}-${index}`}>
                <button
                  className={`w-full rounded border border-border px-2 py-1 text-left text-xs hover:bg-muted ${
                    severity === 'error'
                      ? 'text-destructive'
                      : 'text-muted-foreground'
                  }`}
                  data-line={line}
                  data-severity={severity}
                  data-testid='code-diagnostic'
                  onClick={onDiagnostic}
                  type='button'
                >
                  <span className='font-medium'>{severity}</span>
                  <span> · {message}</span>
                  <span className='ml-1 opacity-70'>Line {line}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      <p className='text-muted-foreground text-xs' id='code-hint'>
        {frame === null
          ? 'The source applies to the selected frame.'
          : 'Ctrl or Command + Enter applies it to the frame.'}
      </p>
      <Button
        data-testid='code-apply'
        disabled={frame === null}
        onClick={applyNow}
        size='sm'
        variant='outline'
      >
        Apply to frame
      </Button>
      <dialog
        aria-label='Replace hand edits'
        className='m-auto w-80 rounded-lg border border-border bg-background p-6 text-foreground outline-none backdrop:bg-foreground/20'
        data-testid='code-confirm'
        onClose={cancelApply}
        ref={confirmRef}
      >
        <h2 className='font-heading font-semibold text-base'>
          Replace hand edits?
        </h2>
        <p className='mt-2 text-muted-foreground text-xs'>
          Shapes this source generated were edited by hand. Applying replaces
          them. Shapes you added inside the frame stay.
        </p>
        <div className='mt-4 flex justify-end gap-2'>
          <Button
            data-testid='code-confirm-cancel'
            onClick={cancelApply}
            size='sm'
            variant='outline'
          >
            Cancel
          </Button>
          <Button
            data-testid='code-confirm-apply'
            onClick={confirmApply}
            size='sm'
          >
            Apply anyway
          </Button>
        </div>
      </dialog>
    </section>
  );
};
