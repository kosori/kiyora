import type { ClipboardMessage } from '../clipboard';

/**
 * One tab's announcement that it has a board open. `hello` starts a handshake,
 * `ack` answers one, and `bye` says the tab has gone.
 */
export type PresenceMessage = {
  type: 'hello' | 'ack' | 'bye';
  id: string;
  openedAt: number;
};

/**
 * Everything the board channel carries: the presence handshake, and a tab's
 * clipboard. Both share one BroadcastChannel, so a fragment is tagged rather
 * than read as an announcement.
 */
export type BoardMessage = PresenceMessage | ClipboardMessage;

/** A broadcast channel across tabs, as a port. The app backs it with `BroadcastChannel`. */
export type BoardChannel = {
  post: (message: BoardMessage) => void;
  subscribe: (listener: (message: BoardMessage) => void) => () => void;
  close: () => void;
};

/** The board channel, under the name presence used before it carried a clipboard. */
export type PresenceChannel = BoardChannel;

/**
 * Whether this tab may write the board. Two tabs on one board is an ordinary
 * thing to do, so the later one yields rather than clobbering the earlier: the
 * older tab keeps writing, the newer warns its user, and when the older leaves,
 * the newer takes over and clears the warning.
 */
export type Presence = {
  isPrimary: () => boolean;
  /** The id of the tab this one yielded to, while it is secondary. */
  leader: () => string | null;
  subscribe: (listener: () => void) => () => void;
  /** Announces departure and stops listening. */
  leave: () => void;
};

/** The tab that has been open longest wins; two opened in the same tick break by id. */
const isOlder = (peer: PresenceMessage, self: PresenceMessage): boolean =>
  peer.openedAt < self.openedAt ||
  (peer.openedAt === self.openedAt && peer.id < self.id);

/**
 * Runs the cross-tab handshake over `channel`. The machine starts primary and
 * yields the moment it hears an older tab; it answers a newcomer so the newcomer
 * learns of it, and never answers twice, so the exchange terminates.
 */
export const createPresence = ({
  channel,
  self,
}: {
  channel: BoardChannel;
  self: { id: string; openedAt: number };
}): Presence => {
  const mine: PresenceMessage = {
    id: self.id,
    openedAt: self.openedAt,
    type: 'hello',
  };
  let primary = true;
  let leaderId: string | null = null;
  const listeners = new Set<() => void>();

  const publish = (): void => {
    for (const listener of listeners) {
      listener();
    }
  };

  const onMessage = (message: BoardMessage): void => {
    if (message.type === 'clipboard') {
      return;
    }
    if (message.id === self.id) {
      return;
    }
    if (message.type === 'bye') {
      if (leaderId === message.id) {
        primary = true;
        leaderId = null;
        publish();
      }
      return;
    }
    if (isOlder(message, mine)) {
      if (leaderId !== message.id || primary) {
        primary = false;
        leaderId = message.id;
        publish();
      }
      return;
    }
    if (message.type === 'hello' && primary) {
      channel.post({ ...mine, type: 'ack' });
    }
  };

  const stop = channel.subscribe(onMessage);
  channel.post(mine);

  return {
    isPrimary: () => primary,
    leader: () => leaderId,
    leave: () => {
      channel.post({ ...mine, type: 'bye' });
      stop();
      channel.close();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};
