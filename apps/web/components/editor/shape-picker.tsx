'use client';

import { isFigureTool } from '@kiyora/editor';
import { useEditor, useTool } from '@kiyora/editor/react';
import { FIGURE_KINDS, type FigureKind } from '@kiyora/model';
import { IconShape } from '@tabler/icons-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '~/components/ui/button';

/** A kind's name as a person reads it: `predefined-process` to `Predefined Process`. */
export const figureLabel = (kind: FigureKind): string =>
  kind
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

type ItemProps = {
  kind: FigureKind;
  onChoose: (kind: FigureKind) => void;
  selected: boolean;
};

/** One menu entry: it names a kind, and choosing it hands that kind back. */
const ShapePickerItem = ({ kind, onChoose, selected }: ItemProps) => {
  const choose = useCallback(() => onChoose(kind), [kind, onChoose]);

  return (
    <Button
      className='justify-start'
      onClick={choose}
      role='menuitem'
      size='sm'
      variant={selected ? 'secondary' : 'ghost'}
    >
      {figureLabel(kind)}
    </Button>
  );
};

/**
 * The shape picker: one rail entry that opens the whole figure vocabulary. It
 * only names a kind — choosing one sets the tool — so placing from here and from
 * the rail run the same gesture, and the rail never grows by forty buttons.
 */
export const ShapePicker = () => {
  const editor = useEditor();
  const tool = useTool();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<Element | null>(null);
  const active = isFigureTool(tool);

  useEffect(() => {
    if (!open) {
      return;
    }

    previousFocus.current = document.activeElement;
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();

    const onPointerDown = (event: PointerEvent) => {
      const element = root.current;
      if (element !== null && !element.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      const before = previousFocus.current;
      if (before instanceof HTMLElement && before.isConnected) {
        before.focus();
      }
    };
  }, [open]);

  const toggle = useCallback(() => {
    setOpen((value) => !value);
  }, []);

  const choose = useCallback(
    (kind: FigureKind) => {
      editor.setTool(kind);
      setOpen(false);
    },
    [editor]
  );

  return (
    <div className='relative' ref={root}>
      <Button
        aria-expanded={open}
        aria-haspopup='menu'
        aria-label='Shapes'
        aria-pressed={active}
        data-testid='shape-picker'
        onClick={toggle}
        size='icon'
        title='Shapes'
        variant={active ? 'secondary' : 'ghost'}
      >
        <IconShape />
      </Button>
      {open ? (
        <div
          className='absolute top-0 left-full z-20 ml-1 grid max-h-96 w-56 grid-cols-2 gap-0.5 overflow-y-auto rounded-lg border border-border bg-background p-1 shadow-md'
          data-testid='shape-picker-menu'
          ref={menu}
          role='menu'
        >
          {FIGURE_KINDS.map((kind) => (
            <ShapePickerItem
              key={kind}
              kind={kind}
              onChoose={choose}
              selected={kind === tool}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
};
