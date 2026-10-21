import {
  type Clipboard,
  clipboardMessage,
  readClipboardMessage,
} from '../clipboard';
import type { Editor } from '../state';
import type { BoardChannel, BoardMessage } from './presence';

/** The live link between one tab's clipboard and the board channel. */
export type ClipboardRelay = {
  close: () => void;
};

/**
 * Wires `editor`'s clipboard to `channel`: a copy made here becomes a message
 * for the other tabs, and a current-build message from another tab becomes this
 * tab's clipboard, ready for the paste command that already knows how to re-id
 * it. Presence reads the same channel and discards these by `type`, so a large
 * fragment is never mistaken for a handshake. `origin` is this tab's presence
 * id, so a channel that echoes — as a test one can — does not feed a copy back.
 */
export const createClipboardRelay = ({
  channel,
  editor,
  origin,
}: {
  channel: BoardChannel;
  editor: Editor;
  origin: string;
}): ClipboardRelay => {
  const share = (fragment: Clipboard): void => {
    if (fragment.shapes.length === 0) {
      return;
    }
    channel.post(clipboardMessage(fragment, origin));
  };

  const receive = (message: BoardMessage): void => {
    if (message.type !== 'clipboard' || message.origin === origin) {
      return;
    }
    const fragment = readClipboardMessage(message);
    if (fragment !== null) {
      editor.receiveClipboard(fragment);
    }
  };

  const stopChannel = channel.subscribe(receive);
  const stopEditor = editor.subscribeClipboard(share);

  return {
    close: () => {
      stopEditor();
      stopChannel();
    },
  };
};
