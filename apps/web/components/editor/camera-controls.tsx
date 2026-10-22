import { keyshortcutsFor, type Tool } from '@kiyora/editor';
import { Button } from '~/components/ui/button';

type Props = {
  fit: () => void;
  reset: () => void;
  toggleTool: () => void;
  tool: Tool;
  zoom: number;
  zoomIn: () => void;
  zoomOut: () => void;
};

/** The bottom-left cluster: how the board is looked at, and the hand that moves it. */
export const CameraControls = ({
  fit,
  reset,
  toggleTool,
  tool,
  zoom,
  zoomIn,
  zoomOut,
}: Props) => (
  <div
    className='absolute bottom-3 left-3 flex items-center gap-0.5 rounded-lg border border-border bg-background/90 p-1 shadow-sm backdrop-blur'
    data-testid='camera-controls'
  >
    <Button
      aria-label='Hand tool'
      aria-pressed={tool === 'hand'}
      data-testid='hand-tool'
      onClick={toggleTool}
      size='sm'
      variant={tool === 'hand' ? 'secondary' : 'ghost'}
    >
      Hand
    </Button>
    <Button
      aria-keyshortcuts={keyshortcutsFor({
        action: 'zoom-out',
        kind: 'camera',
      })}
      aria-label='Zoom out'
      data-testid='zoom-out'
      onClick={zoomOut}
      size='icon-sm'
      variant='ghost'
    >
      {'\u2212'}
    </Button>
    <span
      className='w-11 text-center text-xs tabular-nums'
      data-testid='zoom-percentage'
    >
      {`${Math.round(zoom * 100)}%`}
    </span>
    <Button
      aria-keyshortcuts={keyshortcutsFor({ action: 'zoom-in', kind: 'camera' })}
      aria-label='Zoom in'
      data-testid='zoom-in'
      onClick={zoomIn}
      size='icon-sm'
      variant='ghost'
    >
      +
    </Button>
    <Button data-testid='fit' onClick={fit} size='sm' variant='ghost'>
      Fit
    </Button>
    <Button
      aria-label='Reset to one hundred percent'
      data-testid='reset'
      onClick={reset}
      size='sm'
      variant='ghost'
    >
      Reset
    </Button>
  </div>
);
