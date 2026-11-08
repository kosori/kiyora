'use client';

import { IconCode, IconPresentation, IconUpload } from '@tabler/icons-react';
import { cn } from 'cn';
import type { ReactNode } from 'react';
import { Button } from '~/components/ui/button';

type Props = {
  onCreateSlides: () => void;
  onOpenCode: () => void;
  onImportFile: () => void;
};

type AnnotationProps = {
  arrow: string;
  children: ReactNode;
  className: string;
};

/** One sketched hint: a caption with a hand-drawn arrow beside the chrome it names. */
const Annotation = ({ arrow, children, className }: AnnotationProps) => (
  <div
    aria-hidden='true'
    className={cn(
      'pointer-events-none absolute hidden text-[14px] text-muted-foreground xl:block',
      className
    )}
  >
    <span className='block'>{children}</span>
    <svg
      aria-hidden='true'
      className={cn('mt-1 h-9 w-16', arrow)}
      fill='none'
      viewBox='0 0 64 40'
    >
      <path
        d='M4 4C18 8 34 18 52 32'
        stroke='currentColor'
        strokeLinecap='round'
        strokeWidth='1.5'
      />
      <path
        d='M43 31L52 32L51 23'
        stroke='currentColor'
        strokeLinecap='round'
        strokeLinejoin='round'
        strokeWidth='1.5'
      />
    </svg>
  </div>
);

/** A keyboard chip: the key and what it picks, set in the chrome's quiet surface. */
const Chip = ({ children }: { children: ReactNode }) => (
  <span className='inline-flex h-6 items-center rounded-[6px] bg-[var(--chrome-hover)] px-2 py-[2px] text-[13px] text-muted-foreground shadow-[0_0_0_1px_var(--border)]'>
    {children}
  </span>
);

type ActionProps = {
  children: ReactNode;
  icon: ReactNode;
  onClick: () => void;
  testId: string;
};

/** One empty-canvas action pill. */
const Action = ({ children, icon, onClick, testId }: ActionProps) => (
  <Button
    className='chrome-hover pointer-events-auto h-9 gap-2 rounded-[12px] bg-[var(--chrome-hover)] px-3 font-medium text-[13px] text-foreground shadow-[0_0_0_1px_var(--border)] hover:bg-[var(--chrome-hover)]'
    data-testid={testId}
    onClick={onClick}
    size='default'
    type='button'
    variant='ghost'
  >
    {icon}
    {children}
  </Button>
);

/**
 * The empty board's onboarding: a centred mark and the three ways to start a
 * board, with sketched hints to the chrome around it. The overlay takes no
 * pointer events of its own, so a drag still reaches the canvas.
 */
export const EmptyState = ({
  onCreateSlides,
  onOpenCode,
  onImportFile,
}: Props) => (
  <div
    className='pointer-events-none absolute inset-0 z-10 flex items-center justify-center'
    data-testid='empty-state'
  >
    <div className='flex flex-col items-center gap-5'>
      <span className='flex size-12 items-center justify-center rounded-[12px] bg-black'>
        <svg
          aria-hidden='true'
          className='size-7'
          fill='none'
          viewBox='0 0 48 48'
        >
          <path d='M14 10L38 24L14 38Z' fill='white' />
        </svg>
      </span>
      <p className='text-[18px] text-muted-foreground'>
        Double-click anywhere to add text
      </p>
      <div className='flex flex-wrap items-center justify-center gap-2 text-[13px] text-muted-foreground'>
        <span>or pick a tool</span>
        <span className='inline-flex items-center gap-1.5'>
          <Chip>R</Chip> rectangle
        </span>
        <span className='inline-flex items-center gap-1.5'>
          <Chip>O</Chip> ellipse
        </span>
        <span className='inline-flex items-center gap-1.5'>
          <Chip>A</Chip> arrow
        </span>
        <span className='inline-flex items-center gap-1.5'>
          <Chip>/</Chip> all tools
        </span>
      </div>
      <div className='mt-1 flex items-center gap-2'>
        <Action
          icon={<IconPresentation className='size-4' />}
          onClick={onCreateSlides}
          testId='empty-create-slides'
        >
          Create slides
        </Action>
        <Action
          icon={<IconCode className='size-4' />}
          onClick={onOpenCode}
          testId='empty-code'
        >
          Diagram as code
        </Action>
        <Action
          icon={<IconUpload className='size-4' />}
          onClick={onImportFile}
          testId='empty-import'
        >
          Import file
        </Action>
      </div>
    </div>
    <Annotation arrow='-scale-x-100' className='top-[28%] left-28'>
      Pick a tool from here
    </Annotation>
    <Annotation arrow='-scale-y-100' className='top-24 right-20'>
      Slides &amp; Diagrams as code
    </Annotation>
    <Annotation arrow='-scale-x-100' className='bottom-24 left-28'>
      Zoom &amp; reset view
    </Annotation>
    <Annotation arrow='' className='right-20 bottom-24'>
      Keyboard shortcuts
    </Annotation>
  </div>
);
