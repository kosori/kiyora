'use client';

import type { Tool } from '@kiyora/editor';
import {
  IconFrame,
  IconPointer,
  IconRectangle,
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
  { icon: IconFrame, label: 'Frame', tool: 'frame' },
];

/** The tool rail: every button names its tool, and the active one reads as pressed. */
export const ToolRail = () => (
  <div
    aria-label='Tools'
    className='absolute top-3 left-3 z-10 flex flex-col gap-0.5 rounded-lg border border-border bg-background/90 p-1 shadow-sm backdrop-blur'
    role='toolbar'
  >
    {RAIL.map((entry) => (
      <ToolRailButton entry={entry} key={entry.tool} />
    ))}
    <ShapePicker />
  </div>
);
