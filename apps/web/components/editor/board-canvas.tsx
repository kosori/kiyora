'use client';

import { useBoard } from '@kiyora/editor/react';
import { type Paint, paintBoard } from '@kiyora/model';
import { cn } from 'cn';
import { type ReactNode, useMemo } from 'react';
import { CameraControls } from './camera-controls';
import { DotGrid } from './dot-grid';
import { Marquee } from './marquee';
import { SelectionFrame } from './selection-frame';
import { useBoardPointer } from './use-board-pointer';
import { useCameraSurface } from './use-camera-surface';
import { useShortcuts } from './use-shortcuts';

type Props = {
  onShowShortcuts: () => void;
};

const PaintPaths = ({ paint }: { paint: Paint }): ReactNode => {
  const children = paint.children.map((child, index) => (
    <PaintPaths key={child.shapeId ?? `child-${index}`} paint={child} />
  ));

  return (
    <>
      {paint.paths.map((path, index) => (
        <path
          d={path.d}
          fill={path.fill}
          key={`path-${index}`}
          stroke={path.stroke}
          strokeWidth={path.strokeWidth}
        />
      ))}
      {paint.clip === undefined || paint.shapeId === undefined ? (
        children
      ) : (
        <>
          <clipPath id={`clip-${paint.shapeId}`}>
            <path d={paint.clip} />
          </clipPath>
          <g clipPath={`url(#clip-${paint.shapeId})`}>{children}</g>
        </>
      )}
    </>
  );
};

/**
 * Paints the board through the camera. Every coordinate, colour and width comes
 * from the walker; the camera only decides where the board sits on screen. The
 * paint is server-rendered, and `data-ready` announces the moment the canvas has
 * measured itself — the precondition for any camera action.
 *
 * The pointer handlers sit on the wrapper rather than the canvas so the camera's
 * own pointer plumbing on the `<svg>` is untouched; a pointer event bubbles from
 * the canvas to here, and each tool's handlers ignore the other's. The selection
 * frame and the marquee ride inside the camera's group, so they hug the board
 * wherever the camera takes it.
 */
export const BoardCanvas = ({ onShowShortcuts }: Props) => {
  const board = useBoard();
  const surface = useCameraSurface();
  const pointer = useBoardPointer(surface.hand);

  useShortcuts(onShowShortcuts, surface.intent);

  const paint = useMemo(
    () => paintBoard(board, { theme: board.settings.theme }),
    [board]
  );
  const { camera } = surface.view;

  return (
    <div className='relative h-full w-full' {...pointer}>
      <svg
        aria-label='Board'
        className={cn(
          'h-full w-full touch-none',
          surface.hand ? 'cursor-grab' : 'cursor-default'
        )}
        data-ready={surface.ready ? 'true' : undefined}
        data-testid='canvas'
        ref={surface.ref}
        role='img'
        xmlns='http://www.w3.org/2000/svg'
        {...surface.handlers}
      >
        <DotGrid camera={camera} theme={board.settings.theme} />
        <g
          data-testid='board'
          transform={`translate(${camera.x} ${camera.y}) scale(${camera.zoom})`}
        >
          <PaintPaths paint={paint} />
          <SelectionFrame />
          <Marquee />
        </g>
      </svg>
      <CameraControls
        fit={surface.actions.fit}
        reset={surface.actions.reset}
        toggleTool={surface.actions.toggleTool}
        tool={surface.view.tool}
        zoom={camera.zoom}
        zoomIn={surface.actions.zoomIn}
        zoomOut={surface.actions.zoomOut}
      />
    </div>
  );
};
