'use client';

import type { ReactNode } from 'react';
import { shouldCrashPanel } from '~/lib/panel-crash';

/**
 * Fails its children on purpose when a browser test asks it to, so the panel
 * boundary has something real to catch. In a normal session it is a pass-through.
 */
export const CrashProbe = ({
  children,
  name,
}: {
  children: ReactNode;
  name: string;
}) => {
  if (shouldCrashPanel(name)) {
    throw new Error(`panel "${name}" failed on purpose`);
  }
  return <>{children}</>;
};
