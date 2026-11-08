import { keyshortcutsFor } from '@kiyora/editor';
import { IconMaximize, IconRefresh } from '@tabler/icons-react';
import { Button } from '~/components/ui/button';
import { usePlatform } from './use-platform';

type Props = {
  fit: () => void;
  reset: () => void;
  zoom: number;
  zoomIn: () => void;
  zoomOut: () => void;
};

/**
 * The bottom-left zoom pill: how large the board is drawn. It carries no tool
 * and no theme switch, so the canvas keeps the corner for looking, not editing.
 */
export const CameraControls = ({
  fit,
  reset,
  zoom,
  zoomIn,
  zoomOut,
}: Props) => {
  const platform = usePlatform();

  return (
    <div
      aria-label='Zoom'
      className='chrome-surface chrome-card flex h-10 items-center gap-0.5 p-1'
      data-testid='camera-controls'
      role='toolbar'
    >
      <Button
        aria-keyshortcuts={keyshortcutsFor(
          { action: 'zoom-out', kind: 'camera' },
          platform
        )}
        aria-label='Zoom out'
        className='chrome-icon'
        data-testid='zoom-out'
        onClick={zoomOut}
        size='icon'
        variant='ghost'
      >
        {'\u2212'}
      </Button>
      <span
        className='w-11 text-center text-[13px] text-[var(--chrome-fg)] tabular-nums'
        data-testid='zoom-percentage'
      >
        {`${Math.round(zoom * 100)}%`}
      </span>
      <Button
        aria-keyshortcuts={keyshortcutsFor(
          { action: 'zoom-in', kind: 'camera' },
          platform
        )}
        aria-label='Zoom in'
        className='chrome-icon'
        data-testid='zoom-in'
        onClick={zoomIn}
        size='icon'
        variant='ghost'
      >
        +
      </Button>
      <span aria-hidden='true' className='mx-1 h-4 w-px bg-border' />
      <Button
        aria-label='Zoom to fit'
        className='chrome-icon'
        data-testid='fit'
        onClick={fit}
        size='icon'
        title='Zoom to fit'
        variant='ghost'
      >
        <IconMaximize />
      </Button>
      <Button
        aria-label='Reset view'
        className='chrome-icon'
        data-testid='reset'
        onClick={reset}
        size='icon'
        title='Reset view'
        variant='ghost'
      >
        <IconRefresh />
      </Button>
    </div>
  );
};
