'use client';

import {
  type CommandHost,
  shapeAt,
  toWorld,
  visibleBounds,
} from '@kiyora/editor';
import { useBoard, useEditor } from '@kiyora/editor/react';
import { CANVAS_ENTRY, paintBoard } from '@kiyora/model';
import { cn } from 'cn';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createTextMeasurer } from '~/lib/text-measurer';
import { CameraControls } from './camera-controls';
import { CommandPalette } from './command-palette';
import { ContextMenu } from './context-menu';
import { useCopyPng } from './copy-png-context';
import { DotGrid } from './dot-grid';
import { FindBox } from './find-box';
import { Guides } from './guides';
import { Marquee } from './marquee';
import { PaintNode } from './paint-node';
import { ResizeRefusal } from './resize-refusal';
import { SelectionFrame } from './selection-frame';
import { TextEditor } from './text-editor';
import { useBoardPointer } from './use-board-pointer';
import { useCameraSurface } from './use-camera-surface';
import { useIconSet } from './use-icon-set';
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
 * A right-click on a shape opens the selection's context menu at the pointer;
 * on empty canvas it opens nothing. Its listener sits on the canvas itself, so
 * chrome around the board keeps its own menu. The menu is display state beside
 * the canvas, so neither it nor the selection it reads can reach the document.
 *
 * The board group is unselectable, so a drag that starts on a label's words
 * begins a gesture rather than a text-selection drag — Chromium cancels that
 * drag, and the placement never completes. Keeping the text hit-testable rather
 * than removing it with `pointer-events` leaves a label's link clickable.
 */
export const BoardCanvas = ({ onShowShortcuts }: Props) => {
  const board = useBoard();
  const editor = useEditor();
  const surface = useCameraSurface();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [finding, setFinding] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [palette, setPalette] = useState(false);
  const openEditor = useCallback((id: string) => setEditingId(id), []);
  const closeEditor = useCallback(() => setEditingId(null), []);
  const openFind = useCallback(() => setFinding(true), []);
  const closeFind = useCallback(() => setFinding(false), []);
  const closeMenu = useCallback(() => setMenu(null), []);
  const showPalette = useCallback(() => setPalette(true), []);
  const pointer = useBoardPointer(surface.hand, openEditor);
  const measure = useMemo(() => createTextMeasurer(), []);
  const icons = useIconSet();
  const { copy: copyPng } = useCopyPng();
  const { camera } = surface.view;

  useShortcuts(onShowShortcuts, surface.intent, openFind, showPalette, copyPng);

  /**
   * The palette's own host. Pan is a held key and a chooser has no keyup, so
   * choosing it releases the pan at once instead of leaving the hand stuck.
   */
  const paletteHost = useMemo<CommandHost>(
    () => ({
      camera: (action, phase) => {
        surface.intent.run(action, phase);
        if (action === 'pan') {
          surface.intent.run('pan', 'up');
        }
      },
      copyPng,
      openFind,
      showPalette,
      showShortcuts: onShowShortcuts,
    }),
    [copyPng, onShowShortcuts, openFind, showPalette, surface.intent]
  );

  const openContextMenu = useCallback(
    (event: MouseEvent, element: SVGSVGElement) => {
      event.preventDefault();
      const box = element.getBoundingClientRect();
      const at = { x: event.clientX - box.left, y: event.clientY - box.top };
      const hit = shapeAt(board.shapes, toWorld(camera, at), true);
      if (hit === null) {
        return;
      }
      if (!editor.getSelection().includes(hit.id)) {
        editor.setSelection([hit.id]);
      }
      setMenu(at);
    },
    [board.shapes, camera, editor]
  );

  useEffect(() => {
    const element = surface.ref.current;
    if (element === null) {
      return;
    }
    const onContextMenu = (event: MouseEvent) => {
      openContextMenu(event, element);
    };
    element.addEventListener('contextmenu', onContextMenu);

    return () => element.removeEventListener('contextmenu', onContextMenu);
  }, [openContextMenu, surface.ref]);

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
        icons,
        measure,
        theme: board.settings.theme,
        ...(view === null ? {} : { view }),
      }),
    [board, icons, measure, view]
  );

  return (
    <>
      <div className='relative h-full w-full' {...pointer}>
        <svg
          aria-label='Board'
          className={cn(
            'h-full w-full touch-none',
            surface.hand ? 'cursor-grab' : 'cursor-default'
          )}
          data-ready={surface.ready ? 'true' : undefined}
          data-testid='canvas'
          id='board'
          ref={surface.ref}
          role='img'
          tabIndex={-1}
          xmlns='http://www.w3.org/2000/svg'
          {...surface.handlers}
        >
          <rect
            data-testid='canvas-fill'
            fill={CANVAS_ENTRY[board.settings.theme]}
            height='100%'
            width='100%'
          />
          <DotGrid camera={camera} theme={board.settings.theme} />
          <g
            className='select-none'
            data-testid='board'
            transform={`translate(${camera.x} ${camera.y}) scale(${camera.zoom})`}
          >
            <PaintNode paint={paint} />
            <Guides />
            <SelectionFrame />
            <Marquee />
          </g>
        </svg>
        <ResizeRefusal />
        {menu === null ? null : (
          <ContextMenu at={menu} host={paletteHost} onClose={closeMenu} />
        )}
        {finding ? (
          <FindBox onClose={closeFind} viewport={surface.viewport} />
        ) : null}
        {editingId === null ? null : (
          <TextEditor
            measure={measure}
            onDone={closeEditor}
            shapeId={editingId}
          />
        )}
        {surface.view.zen ? null : (
          <CameraControls
            fit={surface.actions.fit}
            reset={surface.actions.reset}
            toggleTool={surface.actions.toggleTool}
            tool={surface.view.tool}
            zoom={camera.zoom}
            zoomIn={surface.actions.zoomIn}
            zoomOut={surface.actions.zoomOut}
          />
        )}
      </div>
      <CommandPalette
        host={paletteHost}
        onOpenChange={setPalette}
        open={palette}
      />
    </>
  );
};
