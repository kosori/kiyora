'use client';

import { keyshortcutsFor } from '@kiyora/editor';
import { useBoard, useEditor } from '@kiyora/editor/react';
import {
  DECK_TEMPLATES,
  deckFrames,
  framesWithoutSlide,
  presentedSlides,
} from '@kiyora/model';
import { type MouseEvent, useCallback } from 'react';
import { Button } from '~/components/ui/button';
import { SlideNotes } from './slide-notes';
import { usePlatform } from './use-platform';

const HEADING = 'mb-1.5 text-muted-foreground text-xs uppercase tracking-wide';

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
  const platform = usePlatform();
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
    <section
      className='flex h-full flex-col gap-4 overflow-y-auto p-3'
      data-testid='deck'
    >
      <section>
        <div className='mb-2 flex items-center justify-between'>
          <h2 className='font-heading font-medium text-sm'>Slides</h2>
          <Button
            aria-keyshortcuts={keyshortcutsFor({ kind: 'present' }, platform)}
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
    </section>
  );
};
