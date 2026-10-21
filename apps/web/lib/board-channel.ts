import type { BoardChannel, BoardMessage } from '@kiyora/editor';

/** The channel every Kiyora tab listens on. Namespaced like every other key. */
const CHANNEL = 'kiyora:board';

/**
 * A broadcast channel across this origin's tabs. `BroadcastChannel` is the whole
 * mechanism: tabs in one browser profile share it, and nothing leaves the
 * machine. Presence and the clipboard both travel over it, tagged by `type`, so
 * one channel serves both without either mistaking the other's traffic. The
 * editor takes it as a port so its handshake stays DOM-free.
 */
export const openBoardChannel = (): BoardChannel => {
  const channel = new BroadcastChannel(CHANNEL);

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
