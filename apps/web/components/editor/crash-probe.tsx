'use client';

import type { PropsWithChildren } from 'react';
import { shouldCrashPanel } from '~/lib/panel-crash';

type Props = {
  name: string;
};

/**
 * Fails its children on purpose when a browser test asks it to, so the panel
 * boundary has something real to catch. In a normal session it is a pass-through.
 */
export const CrashProbe = ({ children, name }: PropsWithChildren<Props>) => {
  if (shouldCrashPanel(name)) {
    throw new Error(`panel "${name}" failed on purpose`);
  }
  return <>{children}</>;
};
