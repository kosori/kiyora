'use client';

import { useEditor, useTool } from '@kiyora/editor/react';
import { useCallback } from 'react';
import { Button } from '~/components/ui/button';
import type { RailEntry } from './tool-rail';

type Props = {
  entry: RailEntry;
};

/** One rail button: it names its tool, marks itself pressed, and selects on click. */
export const ToolRailButton = ({ entry }: Props) => {
  const editor = useEditor();
  const tool = useTool();
  const { icon: Icon, label, tool: value } = entry;
  const pressed = value === tool;

  const select = useCallback(() => {
    editor.setTool(value);
  }, [editor, value]);

  return (
    <Button
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
