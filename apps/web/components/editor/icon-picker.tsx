'use client';

import { useEditor, useTool } from '@kiyora/editor/react';
import type { IconSet } from '@kiyora/model';
import { IconIcons } from '@tabler/icons-react';
import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Button } from '~/components/ui/button';
import { loadIconModule } from '~/lib/icon-set';
import { IconPickerItem } from './icon-picker-item';

/** The dataset as the picker reads it: names to paths, and the square they share. */
type Dataset = {
  icons: IconSet;
  viewBox: number;
};

/** An icon's name as a person reads it: `arrow-right` to `Arrow right`. */
const iconLabel = (name: string): string => {
  const words = name.replaceAll('-', ' ');

  return `${words.charAt(0).toUpperCase()}${words.slice(1)}`;
};

/**
 * The icon picker: one rail entry beside the shape picker. Opening it is the
 * first moment the dataset is fetched, so a board that never uses an icon never
 * pays for the library. Choosing a name arms the icon tool, and the placement
 * gesture places it exactly like any other shape tool.
 */
export const IconPicker = () => {
  const editor = useEditor();
  const tool = useTool();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const previousFocus = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    previousFocus.current = document.activeElement;
    search.current?.focus();

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

  useEffect(() => {
    if (!open || dataset !== null) {
      return;
    }
    let live = true;

    loadIconModule()
      .then(({ ICONS, ICON_VIEWBOX }) => {
        if (live) {
          setDataset({ icons: ICONS, viewBox: ICON_VIEWBOX });
        }
      })
      .catch(() => undefined);

    return () => {
      live = false;
    };
  }, [dataset, open]);

  const names = useMemo(() => {
    if (dataset === null) {
      return [];
    }
    const wanted = query.trim().toLowerCase();

    return Object.keys(dataset.icons).filter(
      (name) => wanted === '' || iconLabel(name).toLowerCase().includes(wanted)
    );
  }, [dataset, query]);

  const toggle = useCallback(() => {
    setOpen((value) => !value);
    setQuery('');
  }, []);

  const onSearch = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value),
    []
  );

  const choose = useCallback(
    (name: string) => {
      editor.setIcon(name);
      setOpen(false);
      setQuery('');
    },
    [editor]
  );

  return (
    <div className='relative' ref={root}>
      <Button
        aria-expanded={open}
        aria-haspopup='menu'
        aria-label='Icons'
        aria-pressed={tool === 'icon'}
        data-testid='icon-picker'
        onClick={toggle}
        size='icon'
        title='Icons'
        variant={tool === 'icon' ? 'secondary' : 'ghost'}
      >
        <IconIcons />
      </Button>
      {open ? (
        <div
          className='absolute top-0 left-full z-20 flex max-h-96 w-64 flex-col gap-1 rounded-lg border border-border bg-background p-1 shadow-md'
          data-testid='icon-picker-menu'
          role='menu'
        >
          <input
            aria-label='Search icons'
            className='h-8 rounded border border-border bg-background px-2 text-sm'
            data-testid='icon-search'
            onChange={onSearch}
            placeholder='Search icons'
            ref={search}
            type='search'
            value={query}
          />
          {dataset === null ? (
            <p className='px-1 py-2 text-muted-foreground text-xs'>
              Loading icons…
            </p>
          ) : names.length === 0 ? (
            <p className='px-1 py-2 text-muted-foreground text-xs'>
              No icons match.
            </p>
          ) : (
            <div className='grid grid-cols-4 gap-0.5 overflow-y-auto'>
              {names.map((name) => (
                <IconPickerItem
                  key={name}
                  name={name}
                  onChoose={choose}
                  paths={dataset.icons[name] ?? ''}
                  viewBox={dataset.viewBox}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};
