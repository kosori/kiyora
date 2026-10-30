import {
  type BoardChannel,
  type BoardMessage,
  createPresence,
} from '@kiyora/editor';
import { describe, expect, it } from 'vitest';

/** A channel every presence on it shares, the way BroadcastChannel spans tabs. */
const sharedChannel = (): BoardChannel => {
  const listeners = new Set<(message: BoardMessage) => void>();
  return {
    close: () => undefined,
    post: (message) => {
      for (const listener of [...listeners]) {
        listener(message);
      }
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};

describe('two tabs on one board', () => {
  it('lets the tab that opened first keep writing', () => {
    const channel = sharedChannel();
    const first = createPresence({
      channel,
      self: { id: 'a', openedAt: 1 },
    });
    const second = createPresence({
      channel,
      self: { id: 'b', openedAt: 2 },
    });

    expect(first.isPrimary()).toBe(true);
    expect(second.isPrimary()).toBe(false);
    expect(second.leader()).toBe('a');
  });

  it('breaks a same-tick tie by id, so both agree without a race', () => {
    const channel = sharedChannel();
    const first = createPresence({
      channel,
      self: { id: 'a', openedAt: 5 },
    });
    const second = createPresence({
      channel,
      self: { id: 'b', openedAt: 5 },
    });

    expect(first.isPrimary()).toBe(true);
    expect(second.isPrimary()).toBe(false);
  });

  it('hands the board over when the holder leaves', () => {
    const channel = sharedChannel();
    const first = createPresence({
      channel,
      self: { id: 'a', openedAt: 1 },
    });
    const second = createPresence({
      channel,
      self: { id: 'b', openedAt: 2 },
    });

    expect(second.isPrimary()).toBe(false);

    first.leave();

    expect(second.isPrimary()).toBe(true);
    expect(second.leader()).toBeNull();
  });

  it('ignores a tab listening to its own announcements', () => {
    const channel = sharedChannel();
    const solo = createPresence({
      channel,
      self: { id: 'a', openedAt: 1 },
    });

    expect(solo.isPrimary()).toBe(true);
  });
});

describe('two tabs on two boards', () => {
  it('elects each board separately, so neither tab rivals the other', () => {
    const first = createPresence({
      channel: sharedChannel(),
      self: { id: 'a', openedAt: 1 },
    });
    const second = createPresence({
      channel: sharedChannel(),
      self: { id: 'b', openedAt: 2 },
    });

    expect(first.isPrimary()).toBe(true);
    expect(second.isPrimary()).toBe(true);

    first.leave();

    expect(second.isPrimary()).toBe(true);
    expect(second.leader()).toBeNull();
  });
});
