'use client';

import {
  HANDLE_SIZE,
  HANDLES,
  handlePositions,
  rotateHandlePosition,
  selectionBounds,
} from '@kiyora/editor';
import { useBoard, useSelection, useView } from '@kiyora/editor/react';
import { paintColour } from '@kiyora/model';

/** The resize cursor that suits where a handle sits, so its intent reads before a drag. */
const CURSORS: Record<string, string> = {
  e: 'ew-resize',
  n: 'ns-resize',
  ne: 'nesw-resize',
  nw: 'nwse-resize',
  s: 'ns-resize',
  se: 'nwse-resize',
  sw: 'nesw-resize',
  w: 'ew-resize',
};

/**
 * The frame around the selection, its eight resize handles and its rotate
 * handle, drawn in board coordinates inside the camera's group. Display-only:
 * none of it reaches an artifact. Handle reach and the rotate handle's offset
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

  const colour = paintColour('blue', board.settings.theme);
  const size = HANDLE_SIZE / camera.zoom;
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
        stroke={colour}
        strokeWidth={1.5}
        vectorEffect='non-scaling-stroke'
        width={bounds.w}
        x={bounds.x}
        y={bounds.y}
      />
      {resizable ? (
        <>
          <line
            pointerEvents='none'
            stroke={colour}
            strokeWidth={1.5}
            vectorEffect='non-scaling-stroke'
            x1={bounds.x + bounds.w / 2}
            x2={rotate.x}
            y1={bounds.y}
            y2={rotate.y}
          />
          {HANDLES.map((kind) => {
            const point = positions[kind];

            return (
              <rect
                data-handle={kind}
                data-testid={`handle-${kind}`}
                fill={colour}
                height={size}
                key={kind}
                pointerEvents='all'
                stroke={colour}
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
            fill={colour}
            pointerEvents='all'
            r={size / 2}
            stroke={colour}
            strokeWidth={1}
            style={{ cursor: 'grab' }}
            vectorEffect='non-scaling-stroke'
          />
        </>
      ) : null}
    </g>
  );
};
