'use client';

import type { Tool } from '@kiyora/editor';
import {
  IconArrowUpRight,
  IconFrame,
  IconNote,
  IconPointer,
  IconRectangle,
  IconTypography,
  type TablerIcon,
} from '@tabler/icons-react';
import { ShapePicker } from './shape-picker';
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

/** The tools the rail offers. The picker carries the rest of the vocabulary. */
const RAIL: readonly RailEntry[] = [
  { icon: IconPointer, label: 'Select', tool: 'select' },
  { icon: IconRectangle, label: 'Rectangle', tool: 'rectangle' },
  { icon: IconTypography, label: 'Text', tool: 'text' },
  { icon: IconArrowUpRight, label: 'Connector', tool: 'connector' },
  { icon: IconNote, label: 'Sticky', tool: 'sticky' },
  { icon: IconFrame, label: 'Frame', tool: 'frame' },
];

/** The tool rail: every button names its tool, and the active one reads as pressed. */
export const ToolRail = () => (
  <aside
    aria-label='Tools'
    className='flex h-full w-12 shrink-0 flex-col items-center gap-0.5 border-border border-r bg-background p-2'
    role='toolbar'
  >
    {RAIL.map((entry) => (
      <ToolRailButton entry={entry} key={entry.tool} />
    ))}
    <ShapePicker />
  </aside>
);
