'use client';

import {
  HANDLE_SIZE,
  HANDLES,
  type HandleKind,
  handlePositions,
  rotateHandlePosition,
  selectionBounds,
} from '@kiyora/editor';
import { useBoard, useSelection, useView } from '@kiyora/editor/react';

/** The colour the selection furniture is drawn in, whichever theme the board wears. */
const SELECTION_COLOUR = '#4da1ff';

/** The fill a handle carries, so a corner reads as open rather than as ink. */
const HANDLE_FILL = '#ffffff';

/** The resize cursor that suits where a handle sits, so its intent reads before a drag. */
const CURSORS: Record<HandleKind, string> = {
  ne: 'nesw-resize',
  nw: 'nwse-resize',
  se: 'nwse-resize',
  sw: 'nesw-resize',
};

/**
 * The frame around the selection, its four corner handles and its rotate
 * handle, drawn in board coordinates inside the camera's group. Display-only:
 * none of it reaches an artifact. Handle size and the rotate handle's offset
 * are divided by the zoom, so they hold one size on screen at every scale, the
 * same box the engine hit-tests against.
 */
export const SelectionFrame = () => {
  const board = useBoard();
  const selection = useSelection();
  const { camera } = useView();
  const bounds = selectionBounds(board, selection);

  if (bounds === null) {
    return null;
  }

  const size = HANDLE_SIZE / camera.zoom;
  const radius = 2 / camera.zoom;
  const positions = handlePositions(bounds);
  const rotate = rotateHandlePosition(bounds, camera.zoom);
  const resizable = !board.shapes.some(
    (shape) => selection.includes(shape.id) && shape.kind === 'connector'
  );

  return (
    <g data-testid='selection'>
      <rect
        data-testid='selection-frame'
        fill='none'
        height={bounds.h}
        pointerEvents='none'
        stroke={SELECTION_COLOUR}
        strokeWidth={1.5}
        vectorEffect='non-scaling-stroke'
        width={bounds.w}
        x={bounds.x}
        y={bounds.y}
      />
      {resizable ? (
        <>
          {HANDLES.map((kind) => {
            const point = positions[kind];

            return (
              <rect
                data-handle={kind}
                data-testid={`handle-${kind}`}
                fill={HANDLE_FILL}
                height={size}
                key={kind}
                pointerEvents='all'
                rx={radius}
                ry={radius}
                stroke={SELECTION_COLOUR}
                strokeWidth={1}
                style={{ cursor: CURSORS[kind] }}
                vectorEffect='non-scaling-stroke'
                width={size}
                x={point.x - size / 2}
                y={point.y - size / 2}
              />
            );
          })}
          <circle
            cx={rotate.x}
            cy={rotate.y}
            data-handle='rotate'
            data-testid='handle-rotate'
            fill={HANDLE_FILL}
            pointerEvents='all'
            r={size / 2}
            stroke={SELECTION_COLOUR}
            strokeWidth={1}
            style={{ cursor: 'grab' }}
            vectorEffect='non-scaling-stroke'
          />
        </>
      ) : null}
    </g>
  );
};
