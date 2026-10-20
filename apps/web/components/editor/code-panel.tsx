'use client';

import { useBoard, useEditor, useSelection } from '@kiyora/editor/react';
import type { Board, FrameShape } from '@kiyora/model';
import {
  type ChangeEvent,
  type KeyboardEvent,
  useCallback,
  useState,
} from 'react';
import { Button } from '~/components/ui/button';

/** The text a person is typing for one frame, before it is applied. */
type Draft = {
  frameId: string;
  text: string;
};

/** The selected frame, in paint order, or `null` when the selection holds none. */
const selectedFrame = (
  board: Board,
  selection: readonly string[]
): FrameShape | null => {
  const frame = board.shapes.find(
    (shape) => shape.kind === 'frame' && selection.includes(shape.id)
  );

  return frame?.kind === 'frame' ? frame : null;
};

/**
 * The code panel: the selected Frame's Source, as text. Typing only changes this
 * panel — the board moves when Apply runs, and never before. Applying is one
 * gesture, so one undo takes the stamped shapes back, and the text stays on the
 * frame for the next open. A frame with no Source opens an empty panel.
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

  const apply = useCallback(() => {
    if (frame === null) {
      return;
    }
    editor.applySource(frame.id, value);
    setDraft(null);
  }, [editor, frame, value]);

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
    <aside
      aria-label='Code'
      className='flex h-full min-h-0 flex-col gap-2 overflow-y-auto p-3'
      data-testid='code'
    >
      <h2 className='font-heading font-medium text-sm'>Source</h2>
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
        spellCheck={false}
        value={value}
      />
      <p className='text-muted-foreground text-xs' id='code-hint'>
        {frame === null
          ? 'The source applies to the selected frame.'
          : 'Ctrl or Command + Enter applies it to the frame.'}
      </p>
      <Button
        data-testid='code-apply'
        disabled={frame === null}
        onClick={apply}
        size='sm'
        variant='outline'
      >
        Apply to frame
      </Button>
    </aside>
  );
};
