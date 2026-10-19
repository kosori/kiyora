'use client';

import { useBoard, useEditor } from '@kiyora/editor/react';
import {
  DECK_TEMPLATES,
  deckFrames,
  framesWithoutSlide,
  presentedSlides,
} from '@kiyora/model';
import {
  type ChangeEvent,
  type MouseEvent,
  useCallback,
  useState,
} from 'react';
import { Button } from '~/components/ui/button';

const HEADING = 'mb-1.5 text-muted-foreground text-xs uppercase tracking-wide';

/**
 * One slide's notes. The draft is held locally and committed on blur, so a note
 * that takes thirty keystrokes is one board change and one undo, like a label.
 */
const SlideNotes = ({ frameId, notes }: { frameId: string; notes: string }) => {
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

/**
 * The deck panel: the board's slides in order, their notes, and the templates a
 * deck can start from. Every slide is a frame, so the frames not yet in the deck
 * are offered beside it; every action goes through the store, so reordering,
 * duplicating and deleting are undoable board changes and presenting is not.
 *
 * One handler serves every control: each button carries the action and the slide
 * it acts on as data, so no row rebuilds a function on each render.
 */
export const DeckPanel = () => {
  const editor = useEditor();
  const board = useBoard();
  const slides = deckFrames(board);
  const playable = presentedSlides(board);
  const loose = framesWithoutSlide(board);

  const onAction = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const { action, frameId, index, template } = event.currentTarget.dataset;

      if (action === 'present') {
        editor.startPresent();
        return;
      }
      if (action === 'template' && template !== undefined) {
        editor.addSlideFromTemplate(template);
        return;
      }
      if (frameId === undefined) {
        return;
      }
      if (action === 'add-frame') {
        editor.addSlide(frameId);
        return;
      }
      if (action === 'move-up') {
        editor.moveSlide(frameId, Number(index) - 1);
        return;
      }
      if (action === 'move-down') {
        editor.moveSlide(frameId, Number(index) + 1);
        return;
      }
      if (action === 'skip') {
        editor.toggleSlideSkip(frameId);
        return;
      }
      if (action === 'duplicate') {
        editor.duplicateSlide(frameId);
        return;
      }
      if (action === 'delete') {
        editor.deleteSlide(frameId);
      }
    },
    [editor]
  );

  return (
    <aside
      aria-label='Deck'
      className='flex h-full w-64 shrink-0 flex-col gap-4 overflow-y-auto border-border border-l bg-background p-3'
      data-testid='deck'
    >
      <section>
        <div className='mb-2 flex items-center justify-between'>
          <h2 className='font-heading font-medium text-sm'>Slides</h2>
          <Button
            data-action='present'
            data-testid='present-button'
            disabled={playable.length === 0}
            onClick={onAction}
            size='sm'
            variant='default'
          >
            Present
          </Button>
        </div>
        {slides.length === 0 ? (
          <p className='text-muted-foreground text-xs' data-testid='deck-empty'>
            No slides yet. Add a frame, or start from a template.
          </p>
        ) : (
          <ol className='flex flex-col gap-2'>
            {slides.map((entry, index) => (
              <li
                className='rounded border border-border p-2'
                data-frame-id={entry.frame.id}
                data-skipped={entry.slide.skipped}
                data-testid='slide'
                key={entry.frame.id}
              >
                <div className='mb-1 flex items-center justify-between gap-1'>
                  <span className='truncate text-xs'>
                    {index + 1}. {entry.frame.id}
                  </span>
                  <span className='flex gap-0.5'>
                    <Button
                      aria-label='Move slide up'
                      data-action='move-up'
                      data-frame-id={entry.frame.id}
                      data-index={index}
                      data-testid='slide-up'
                      disabled={index === 0}
                      onClick={onAction}
                      size='xs'
                      variant='ghost'
                    >
                      ↑
                    </Button>
                    <Button
                      aria-label='Move slide down'
                      data-action='move-down'
                      data-frame-id={entry.frame.id}
                      data-index={index}
                      data-testid='slide-down'
                      disabled={index === slides.length - 1}
                      onClick={onAction}
                      size='xs'
                      variant='ghost'
                    >
                      ↓
                    </Button>
                  </span>
                </div>
                <SlideNotes
                  frameId={entry.frame.id}
                  notes={entry.slide.notes}
                />
                <div className='mt-1 flex gap-0.5'>
                  <Button
                    data-action='skip'
                    data-frame-id={entry.frame.id}
                    data-testid='slide-skip'
                    onClick={onAction}
                    size='xs'
                    variant='ghost'
                  >
                    {entry.slide.skipped ? 'Unskip' : 'Skip'}
                  </Button>
                  <Button
                    data-action='duplicate'
                    data-frame-id={entry.frame.id}
                    data-testid='slide-duplicate'
                    onClick={onAction}
                    size='xs'
                    variant='ghost'
                  >
                    Duplicate
                  </Button>
                  <Button
                    data-action='delete'
                    data-frame-id={entry.frame.id}
                    data-testid='slide-delete'
                    onClick={onAction}
                    size='xs'
                    variant='ghost'
                  >
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section>
        <h3 className={HEADING}>From a template</h3>
        <div className='flex flex-wrap gap-1'>
          {DECK_TEMPLATES.map((template) => (
            <Button
              data-action='template'
              data-template={template.id}
              data-testid={`template-${template.id}`}
              key={template.id}
              onClick={onAction}
              size='sm'
              variant='outline'
            >
              {template.label}
            </Button>
          ))}
        </div>
      </section>

      {loose.length === 0 ? null : (
        <section>
          <h3 className={HEADING}>Frames</h3>
          <div className='flex flex-col gap-1'>
            {loose.map((frame) => (
              <Button
                data-action='add-frame'
                data-frame-id={frame.id}
                data-testid='frame-to-slide'
                key={frame.id}
                onClick={onAction}
                size='sm'
                variant='ghost'
              >
                Add {frame.id} as a slide
              </Button>
            ))}
          </div>
        </section>
      )}
    </aside>
  );
};
