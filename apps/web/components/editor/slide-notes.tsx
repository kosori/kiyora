'use client';

import { useEditor } from '@kiyora/editor/react';
import { type ChangeEvent, useCallback, useState } from 'react';

type Props = {
  frameId: string;
  notes: string;
};

/**
 * One slide's notes. The draft is held locally and committed on blur, so a note
 * that takes thirty keystrokes is one board change and one undo, like a label.
 */
export const SlideNotes = ({ frameId, notes }: Props) => {
  const editor = useEditor();
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);

  const onFocus = useCallback(() => {
    setDraft(notes);
    setEditing(true);
  }, [notes]);
  const onChange = useCallback((event: ChangeEvent<HTMLTextAreaElement>) => {
    setDraft(event.target.value);
    setEditing(true);
  }, []);
  const onBlur = useCallback(() => {
    if (editing) {
      editor.setSlideNotes(frameId, draft);
      setEditing(false);
    }
  }, [draft, editing, editor, frameId]);

  return (
    <textarea
      aria-label='Slide notes'
      className='min-h-12 w-full resize-none rounded border border-border bg-background p-1.5 text-xs'
      data-testid='slide-notes'
      onBlur={onBlur}
      onChange={onChange}
      onFocus={onFocus}
      placeholder='Speaker notes'
      value={editing ? draft : notes}
    />
  );
};
