import type { BoardChannel, BoardMessage } from '@kiyora/editor';

/** The channel one board's Kiyora tabs listen on. Namespaced like every key. */
const channelName = (boardId: string): string => `kiyora:board:${boardId}`;

/**
 * A broadcast channel across this origin's tabs on one board.
 * `BroadcastChannel` is the whole mechanism: tabs in one browser profile share
 * it, and nothing leaves the machine. Each board gets its own channel, so two
 * tabs on two boards neither elect a leader nor carry a clipboard between them.
 * Presence and the clipboard both travel over it, tagged by `type`, so one
 * channel serves both without either mistaking the other's traffic. The editor
 * takes it as a port so its handshake stays DOM-free.
 */
export const openBoardChannel = (boardId: string): BoardChannel => {
  const channel = new BroadcastChannel(channelName(boardId));

  return {
    close: () => channel.close(),
    post: (message: BoardMessage) => channel.postMessage(message),
    subscribe: (listener) => {
      const onMessage = (event: MessageEvent<BoardMessage>) =>
        listener(event.data);
      channel.addEventListener('message', onMessage);
      return () => channel.removeEventListener('message', onMessage);
    },
  };
};
