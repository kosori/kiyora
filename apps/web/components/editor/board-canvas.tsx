'use client';

import { visibleBounds } from '@kiyora/editor';
import { useBoard } from '@kiyora/editor/react';
import { paintBoard } from '@kiyora/model';
import { cn } from 'cn';
import { useCallback, useMemo, useState } from 'react';
import { createTextMeasurer } from '~/lib/text-measurer';
import { CameraControls } from './camera-controls';
import { DotGrid } from './dot-grid';
import { Marquee } from './marquee';
import { PaintNode } from './paint-node';
import { SelectionFrame } from './selection-frame';
import { TextEditor } from './text-editor';
import { useBoardPointer } from './use-board-pointer';
import { useCameraSurface } from './use-camera-surface';
import { useShortcuts } from './use-shortcuts';

type Props = {
  onShowShortcuts: () => void;
};

/**
 * Paints the board through the camera. Every coordinate, colour and width comes
 * from the walker; the camera only decides where the board sits on screen. The
 * paint is server-rendered, and `data-ready` announces the moment the canvas has
 * measured itself — the precondition for any camera action.
 *
 * The canvas also hands the walker the board box the view shows, so only the
 * shapes in view are in the DOM. The server has no viewport, so the first,
 * server-rendered pass is the whole board; the same measurement that sets
 * `data-ready` narrows it.
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
 *
 * The board group is unselectable, so a drag that starts on a label's words
 * begins a gesture rather than a text-selection drag — Chromium cancels that
 * drag, and the placement never completes. Keeping the text hit-testable rather
 * than removing it with `pointer-events` leaves a label's link clickable.
 */
export const BoardCanvas = ({ onShowShortcuts }: Props) => {
  const board = useBoard();
  const surface = useCameraSurface();
  const [editingId, setEditingId] = useState<string | null>(null);
  const openEditor = useCallback((id: string) => setEditingId(id), []);
  const closeEditor = useCallback(() => setEditingId(null), []);
  const pointer = useBoardPointer(surface.hand, openEditor);
  const measure = useMemo(() => createTextMeasurer(), []);
  const { camera } = surface.view;

  useShortcuts(onShowShortcuts, surface.intent);

  const view = useMemo(
    () =>
      surface.viewport.w > 0 && surface.viewport.h > 0
        ? visibleBounds(camera, surface.viewport)
        : null,
    [camera, surface.viewport]
  );
  const paint = useMemo(
    () =>
      paintBoard(board, {
        measure,
        theme: board.settings.theme,
        ...(view === null ? {} : { view }),
      }),
    [board, measure, view]
  );

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
          className='select-none'
          data-testid='board'
          transform={`translate(${camera.x} ${camera.y}) scale(${camera.zoom})`}
        >
          <PaintNode paint={paint} />
          <SelectionFrame />
          <Marquee />
        </g>
      </svg>
      {editingId === null ? null : (
        <TextEditor
          measure={measure}
          onDone={closeEditor}
          shapeId={editingId}
        />
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
