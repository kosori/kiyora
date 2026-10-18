'use client';

import { useBoard } from '@kiyora/editor/react';
import { type Paint, paintBoard } from '@kiyora/model';
import { cn } from 'cn';
import { type ReactNode, useMemo } from 'react';
import { CameraControls } from './camera-controls';
import { DotGrid } from './dot-grid';
import { useCameraSurface } from './use-camera-surface';

const PaintPaths = ({ paint }: { paint: Paint }): ReactNode => (
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
    {paint.children.map((child, index) => (
      <PaintPaths key={child.shapeId ?? `child-${index}`} paint={child} />
    ))}
  </>
);

/**
 * Paints the board through the camera. Every coordinate, colour and width comes
 * from the walker; the camera only decides where the board sits on screen. The
 * paint is server-rendered, and `data-ready` announces the moment the canvas has
 * measured itself — the precondition for any camera action.
 */
export const BoardCanvas = () => {
  const board = useBoard();
  const surface = useCameraSurface();
  const paint = useMemo(
    () => paintBoard(board, { theme: board.settings.theme }),
    [board]
  );
  const { camera } = surface.view;

  return (
    <div className='relative h-full w-full'>
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
