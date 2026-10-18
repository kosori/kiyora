'use client';

import type { Tool } from '@kiyora/editor';
import {
  IconPointer,
  IconRectangle,
  type TablerIcon,
} from '@tabler/icons-react';
import { ToolRailButton } from './tool-rail-button';

/**
 * One row of the rail. The rail is a list so a tool added later is one entry,
 * and the rest of the vocabulary arrives without reshaping it.
 */
export type RailEntry = {
  icon: TablerIcon;
  label: string;
  tool: Tool;
};

/** The tools the rail offers. Select and rectangle until the vocabulary lands. */
const RAIL: readonly RailEntry[] = [
  { icon: IconPointer, label: 'Select', tool: 'select' },
  { icon: IconRectangle, label: 'Rectangle', tool: 'rectangle' },
];

/** The tool rail: every button names its tool, and the active one reads as pressed. */
export const ToolRail = () => (
  <div
    aria-label='Tools'
    className='flex flex-col gap-1 border-border border-r bg-background p-2'
    role='toolbar'
  >
    {RAIL.map((entry) => (
      <ToolRailButton entry={entry} key={entry.tool} />
    ))}
  </div>
);
