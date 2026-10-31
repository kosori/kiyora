'use client';

import type { Board } from '@kiyora/model';
import { previewBoard } from '@kiyora/model';
import type { ConflictCopy } from '@kiyora/sync';
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { BoardPreview } from '~/components/library/board-preview';
import { Button } from '~/components/ui/button';
import { saveBoardFile } from '~/lib/board-file';
import { iconSetFor } from '~/lib/icon-set';
import { createTextMeasurer } from '~/lib/text-measurer';

type Props = {
  copy: ConflictCopy | null;
  localPreview?: string;
  localTitle: string;
  signedIn: boolean;
  open: boolean;
  onClose: () => void;
  /** Loads the remote copy when the dialog opens. */
  onOpen: () => void;
  onKeepMine: () => Promise<boolean>;
  onTakeTheirs: () => Promise<Board | null>;
  onDuplicateMine: () => Promise<boolean>;
};

const FAILED = 'That resolution did not finish. The conflict is still here.';
const NO_REMOTE = 'The remote copy could not be opened. Try again when online.';

/** The remote board as a preview, painted through the same walker as the list. */
const useRemotePreview = (copy: ConflictCopy | null): string | null => {
  const measure = useMemo(() => createTextMeasurer(), []);
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    if (copy?.status !== 'ready') {
      setSvg(null);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const painted = previewBoard(copy.board, {
          icons: await iconSetFor(copy.board),
          measure,
          theme: copy.board.settings.theme,
        });
        if (!cancelled) {
          setSvg(painted);
        }
      } catch {
        if (!cancelled) {
          setSvg(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [copy, measure]);

  return svg;
};

/**
 * The conflict's one surface: both copies as pictures, named, and the three
 * ways out. It never merges and never chooses for the person. Taking the remote
 * copy keeps the replaced board as a download, so the outcome that overwrites
 * the screen still leaves the other bytes reachable.
 */
export const ConflictDialog = ({
  copy,
  localPreview,
  localTitle,
  signedIn,
  open,
  onClose,
  onOpen,
  onKeepMine,
  onTakeTheirs,
  onDuplicateMine,
}: Props) => {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useId();
  const description = useId();
  const remotePreview = useRemotePreview(copy);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replaced, setReplaced] = useState<Board | null>(null);

  useEffect(() => {
    const element = dialog.current;
    if (element === null) {
      return;
    }
    if (open && !element.open) {
      element.showModal();
      return;
    }
    if (!open && element.open) {
      element.close();
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setError(null);
    setReplaced(null);
    onOpen();
  }, [onOpen, open]);

  const keep = useCallback(() => {
    setBusy(true);
    setError(null);
    onKeepMine()
      .then((done) => {
        if (done) {
          onClose();
        } else {
          setError(FAILED);
        }
      })
      .catch(() => setError(FAILED))
      .finally(() => setBusy(false));
  }, [onClose, onKeepMine]);

  const take = useCallback(() => {
    setBusy(true);
    setError(null);
    onTakeTheirs()
      .then((kept) => {
        if (kept === null) {
          setError(NO_REMOTE);
          return;
        }
        setReplaced(kept);
      })
      .catch(() => setError(NO_REMOTE))
      .finally(() => setBusy(false));
  }, [onTakeTheirs]);

  const duplicate = useCallback(() => {
    setBusy(true);
    setError(null);
    onDuplicateMine()
      .then((done) => {
        if (done) {
          onClose();
        } else {
          setError(FAILED);
        }
      })
      .catch(() => setError(FAILED))
      .finally(() => setBusy(false));
  }, [onClose, onDuplicateMine]);

  const download = useCallback(() => {
    if (replaced !== null) {
      saveBoardFile(replaced);
    }
  }, [replaced]);

  const ready = copy?.status === 'ready';
  const remoteTitle =
    copy?.status === 'ready' ? copy.board.title || 'Untitled' : 'Remote copy';

  return (
    <dialog
      aria-describedby={description}
      aria-labelledby={heading}
      className='m-auto w-full max-w-2xl rounded-lg border border-border bg-background p-6 text-foreground outline-none backdrop:bg-foreground/20'
      data-testid='conflict-dialog'
      onClose={onClose}
      ref={dialog}
    >
      <h2 className='mb-2 font-heading font-semibold text-lg' id={heading}>
        Resolve the conflict
      </h2>
      <p className='mb-4 text-muted-foreground text-sm' id={description}>
        Another browser saved this board first. Choose what happens to the copy
        in this browser.
      </p>
      <div className='mb-4 grid grid-cols-2 gap-4'>
        <figure data-testid='conflict-local'>
          <BoardPreview svg={localPreview} />
          <figcaption className='mt-2 truncate text-sm'>
            This board — {localTitle || 'Untitled'}
          </figcaption>
        </figure>
        <figure data-testid='conflict-remote'>
          <BoardPreview svg={remotePreview ?? undefined} />
          <figcaption className='mt-2 truncate text-sm'>
            Remote copy — {remoteTitle}
          </figcaption>
        </figure>
      </div>
      {copy?.status === 'offline' ? (
        <p
          className='mb-4 text-muted-foreground text-sm'
          data-testid='conflict-offline'
        >
          The remote copy is not in this browser yet. Open this conflict again
          when you are back online.
        </p>
      ) : null}
      {signedIn ? null : (
        <p className='mb-4 text-muted-foreground text-sm'>
          Sign in to upload your copy. Taking the remote copy works from here.
        </p>
      )}
      {error === null ? null : (
        <p
          className='mb-4 text-destructive text-sm'
          data-testid='conflict-error'
          role='alert'
        >
          {error}
        </p>
      )}
      {replaced === null ? null : (
        <div className='mb-4 rounded-lg border border-border p-3'>
          <p className='mb-2 text-sm'>
            The remote copy is now this board. Your bytes are kept in its
            recovery snapshot.
          </p>
          <Button
            data-testid='download-replaced'
            onClick={download}
            size='sm'
            variant='secondary'
          >
            Download your copy
          </Button>
        </div>
      )}
      <div className='flex flex-wrap justify-end gap-2'>
        <Button
          data-testid='duplicate-mine'
          disabled={busy || !ready || !signedIn || replaced !== null}
          onClick={duplicate}
          size='sm'
          variant='outline'
        >
          Duplicate mine
        </Button>
        <Button
          data-testid='take-theirs'
          disabled={busy || !ready || replaced !== null}
          onClick={take}
          size='sm'
          variant='outline'
        >
          Take theirs
        </Button>
        <Button
          data-testid='keep-mine'
          disabled={busy || !signedIn || replaced !== null}
          onClick={keep}
          size='sm'
        >
          Keep mine
        </Button>
        <Button
          data-testid='close-conflict'
          disabled={busy}
          onClick={onClose}
          size='sm'
          variant='ghost'
        >
          Close
        </Button>
      </div>
    </dialog>
  );
};
