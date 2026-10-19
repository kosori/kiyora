'use client';

import { useBoard } from '@kiyora/editor/react';
import { type Paint, paintBoard } from '@kiyora/model';
import { cn } from 'cn';
import { type ReactNode, useCallback, useMemo, useState } from 'react';
import { createTextMeasurer } from '~/lib/text-measurer';
import { CameraControls } from './camera-controls';
import { DotGrid } from './dot-grid';
import { Marquee } from './marquee';
import { SelectionFrame } from './selection-frame';
import { TextEditor } from './text-editor';
import { TextLayer } from './text-layer';
import { useBoardPointer } from './use-board-pointer';
import { useCameraSurface } from './use-camera-surface';
import { useShortcuts } from './use-shortcuts';

type Props = {
  onShowShortcuts: () => void;
};

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
    <TextLayer paint={paint} />
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
 *
 * The pointer handlers sit on the wrapper rather than the canvas so the camera's
 * own pointer plumbing on the `<svg>` is untouched; a pointer event bubbles from
 * the canvas to here, and each tool's handlers ignore the other's. The selection
 * frame and the marquee ride inside the camera's group, so they hug the board
 * wherever the camera takes it.
 *
 * Text is measured by the app's canvas measurer and painted by the walker like
 * every other coordinate, so `apps/web` never wraps or places a word itself. A
 * double click on a shape opens the label overlay here, on the canvas.
 */
export const BoardCanvas = ({ onShowShortcuts }: Props) => {
  const board = useBoard();
  const surface = useCameraSurface();
  const [editingId, setEditingId] = useState<string | null>(null);
  const openEditor = useCallback((id: string) => setEditingId(id), []);
  const closeEditor = useCallback(() => setEditingId(null), []);
  const pointer = useBoardPointer(surface.hand, openEditor);
  const measure = useMemo(() => createTextMeasurer(), []);

  useShortcuts(onShowShortcuts, surface.intent);

  const paint = useMemo(
    () => paintBoard(board, { measure, theme: board.settings.theme }),
    [board, measure]
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
      {editingId === null ? null : (
        <TextEditor onDone={closeEditor} shapeId={editingId} />
      )}
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
