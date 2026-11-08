'use client';

import { keyshortcutsFor } from '@kiyora/editor';
import { useEditor, useTool } from '@kiyora/editor/react';
import { cn } from 'cn';
import { useCallback } from 'react';
import { Button } from '~/components/ui/button';
import type { RailEntry } from './tool-rail';
import { usePlatform } from './use-platform';

type Props = {
  entry: RailEntry;
};

/** One rail button: it names its tool, marks itself pressed, and selects on click. */
export const ToolRailButton = ({ entry }: Props) => {
  const editor = useEditor();
  const platform = usePlatform();
  const tool = useTool();
  const { icon: Icon, label, tool: value } = entry;
  const pressed = value === tool;

  const select = useCallback(() => {
    editor.setTool(value);
  }, [editor, value]);

  return (
    <Button
      aria-keyshortcuts={keyshortcutsFor(
        { kind: 'tool', tool: value },
        platform
      )}
      aria-label={label}
      aria-pressed={pressed}
      className={cn(
        'chrome-icon chrome-fg [&_svg]:size-[18px] [&_svg]:[stroke-width:1.75]',
        pressed
          ? 'hover:bg-[var(--chrome-active)]'
          : 'chrome-hover hover:bg-[var(--chrome-hover)]'
      )}
      data-testid={value === 'hand' ? 'hand-tool' : undefined}
      onClick={select}
      size='icon'
      style={pressed ? { backgroundColor: 'var(--chrome-active)' } : undefined}
      title={label}
      variant='ghost'
    >
      <Icon />
    </Button>
  );
};
