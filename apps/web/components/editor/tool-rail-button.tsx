'use client';

import { keyshortcutsFor } from '@kiyora/editor';
import { useEditor, useTool } from '@kiyora/editor/react';
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
      onClick={select}
      size='icon'
      title={label}
      variant={pressed ? 'secondary' : 'ghost'}
    >
      <Icon />
    </Button>
  );
};
