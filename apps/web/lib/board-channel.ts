import {
  type BoardChannel,
  type BoardMessage,
  isBoardMessage,
} from '@kiyora/editor';

/** The channel one board's Kiyora tabs listen on. Namespaced like every key. */
const channelName = (boardId: string): string => `kiyora:board:${boardId}`;

/**
 * A channel that carries nothing, for a browser without `BroadcastChannel`.
 * The editor still works on this tab; only the cross-tab handshake and the
 * clipboard between tabs are lost. Presence starts primary, which is honest for
 * a tab that cannot hear another, and every call is a no-op so a caller never
 * has to check the capability.
 */
const inertChannel = (): BoardChannel => ({
  close: () => undefined,
  post: () => undefined,
  subscribe: () => () => undefined,
});

/**
 * A broadcast channel across this origin's tabs on one board.
 * `BroadcastChannel` is the whole mechanism: tabs in one browser profile share
 * it, and nothing leaves the machine. Each board gets its own channel, so two
 * tabs on two boards neither elect a leader nor carry a clipboard between them.
 * Presence and the clipboard both travel over it, tagged by `type`, so one
 * channel serves both without either mistaking the other's traffic. The editor
 * takes it as a port so its handshake stays DOM-free.
 *
 * A browser without `BroadcastChannel` gets an inert channel rather than an
 * exception: the board is editable, and only the cross-tab features degrade.
 */
export const openBoardChannel = (boardId: string): BoardChannel => {
  if (typeof BroadcastChannel === 'undefined') {
    return inertChannel();
  }

  const channel = new BroadcastChannel(channelName(boardId));
  let closed = false;

  return {
    close: () => {
      if (closed) {
        return;
      }
      closed = true;
      channel.close();
    },
    post: (message: BoardMessage) => {
      if (closed) {
        return;
      }
      channel.postMessage(message);
    },
    subscribe: (listener) => {
      const onMessage = (event: MessageEvent<unknown>) => {
        if (isBoardMessage(event.data)) {
          listener(event.data);
        }
      };
      channel.addEventListener('message', onMessage);

      return () => channel.removeEventListener('message', onMessage);
    },
  };
};
