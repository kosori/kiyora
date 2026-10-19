import type { PresenceChannel, PresenceMessage } from '@kiyora/editor';

/** The channel every Kiyora tab listens on. Namespaced like every other key. */
const CHANNEL = 'kiyora:board';

/**
 * A broadcast channel across this origin's tabs. `BroadcastChannel` is the whole
 * mechanism: tabs in one browser profile share it, and nothing leaves the
 * machine. The editor takes it as a port so its handshake stays DOM-free.
 */
export const openPresenceChannel = (): PresenceChannel => {
  const channel = new BroadcastChannel(CHANNEL);

  return {
    close: () => channel.close(),
    post: (message: PresenceMessage) => channel.postMessage(message),
    subscribe: (listener) => {
      const onMessage = (event: MessageEvent<PresenceMessage>) =>
        listener(event.data);
      channel.addEventListener('message', onMessage);
      return () => channel.removeEventListener('message', onMessage);
    },
  };
};
