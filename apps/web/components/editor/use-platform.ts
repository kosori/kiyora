'use client';

import type { Platform } from '@kiyora/editor';
import { useSyncExternalStore } from 'react';

/** A browser does not change platform while the page is open, so there is nothing to subscribe to. */
const subscribe = (): (() => void) => () => undefined;

/** The platform in the user agent, read only where a user agent exists. */
const snapshot = (): Platform =>
  /mac/i.test(navigator.userAgent) ? 'macos' : 'other';

/** The server cannot read a platform, so it renders the Ctrl spelling until the browser answers. */
const serverSnapshot = (): Platform => 'other';

/** The platform whose command key the shortcut copy names, so the editor stays DOM-free. */
export const usePlatform = (): Platform =>
  useSyncExternalStore(subscribe, snapshot, serverSnapshot);
