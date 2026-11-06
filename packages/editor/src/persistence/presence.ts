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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/**
 * Whether `value` is a message this build understands, read at the seam where
 * the platform hands one over. Another build, a devtools snippet or any script
 * on this origin can post to a board's channel, so the payload is narrowed here
 * rather than trusted through the event's generic. A clipboard's shapes are
 * checked again when a tab pastes them, so a large fragment is not parsed twice.
 */
export const isBoardMessage = (value: unknown): value is BoardMessage => {
  if (!isRecord(value)) {
    return false;
  }

  if (value.type === 'clipboard') {
    return (
      typeof value.boardId === 'string' &&
      typeof value.origin === 'string' &&
      typeof value.schemaVersion === 'number' &&
      Array.isArray(value.shapes)
    );
  }

  return (
    (value.type === 'hello' || value.type === 'ack' || value.type === 'bye') &&
    typeof value.id === 'string' &&
    typeof value.openedAt === 'number'
  );
};

/** A broadcast channel across tabs, as a port. The app backs it with `BroadcastChannel`. */
export type BoardChannel = {
  post: (message: BoardMessage) => void;
  subscribe: (listener: (message: BoardMessage) => void) => () => void;
  close: () => void;
};

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
