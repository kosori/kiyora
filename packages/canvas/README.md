# @kiyora/canvas

An interactive, framework-agnostic SVG canvas for arranging the immutable
`Scene` produced by [`@kiyora/render`](../render).

The package has a DOM-free editor state core, a small DOM engine, and an
optional React adapter. Canvas edits — node drags, keyboard nudges, resizes,
and Scene-only structural edits (delete, copy, cut, paste, duplicate) —
mutate the Scene and enter History, but never write back to the source
program: the next compile resets structure to what the source declares.

## Installation

```sh
bun add @kiyora/canvas @kiyora/render
```

React consumers should also have `react` and `react-dom` installed. They are
peer dependencies and are only used by the `@kiyora/canvas/react` adapter.

## Core API

```ts
import {
	createEditor,
	createEngine,
	renderScene,
	fitToBounds,
	panBy,
	panTo,
	resetView,
	screenToWorld,
	visibleWorld,
	worldToScreen,
	zoomAt,
	type Scene,
} from '@kiyora/canvas';

const scene: Scene = {
	edges: [],
	groups: [],
	nodes: [],
	title: '',
};
const editor = createEditor(scene);

// The Editor is framework-agnostic and can be connected to any view layer.
const unsubscribe = editor.subscribe(() => {
	const snapshot = editor.getSnapshot();
	const svg = renderScene(snapshot);
	console.log(svg);
});

// Mount the same projection into a browser container when a DOM is available.
const engine = createEngine(document.querySelector('#canvas')!, editor);

editor.select(null);
editor.panBy(24, 12);
editor.zoomAt({ x: 320, y: 240 }, 1.2);
editor.fitToBounds(
	{ x: 0, y: 0, width: 640, height: 480 },
	{ width: 800, height: 600 }
);

// Pure viewport helpers are also available independently of an Editor.
const screen = worldToScreen(editor.getViewport(), { x: 10, y: 20 });
const world = screenToWorld(editor.getViewport(), screen);
const viewport = zoomAt(editor.getViewport(), screen, 1.2);
void [fitToBounds, panBy, panTo, resetView, visibleWorld, world, viewport];

engine.destroy();
unsubscribe();
```

### Editor

`createEditor(scene?)` returns an `Editor` containing a `Scene`, `Viewport`,
selection, and capped undo/redo history. `getSnapshot()` returns the stable
snapshot used by subscribers. The editor exposes:

- `subscribe` / `getSnapshot`, `getScene`, `setScene`
- `getViewport`, `setViewport`, `panBy`, `zoomAt`, `fitToBounds`, `resetView`
- `hitTest`, `select`, `selectMany`, `toggleSelect`, `getSelection`
- `beginDrag(id)`, `drag`, `endDrag`, `beginNudge()`, `nudge`, `endNudge`,
  `beginResize(id, handle)`, `resizeTo`, `resizeBy(direction)`, `endResize`,
  `cancelResize`, `undo`, `redo`, `canUndo`, `canRedo`
- `deleteSelection`, `copy`, `cut`, `paste`, `duplicate`

Selection, viewport changes, and an in-progress drag are not history entries.
A completed drag creates one entry, and a new edit clears the redo stack.
`beginDrag`/`drag`/`endDrag` move nodes by screen-space deltas with an
always-on 8-px screen-grid snap (`SNAP_STEP`); a multi-drag snaps the
selection's bounding-box top-left and applies one uniform delta.
`beginNudge`/`nudge(direction, byGridStep)`/`endNudge` move the selection by
one world unit per press, or a `SNAP_STEP`-pixel screen step (converted at the
current zoom) when `byGridStep` is set; a run coalesces into one entry.
Resize works as a pointer gesture and a keyboard run:
`beginResize(id, handle)`/`resizeTo(point)`/`endResize` drags one of the eight
handles in world space, clamped to the 40×24 minimum, and
`resizeBy(direction)` grows the single selected node by one snap-grid step per
press, coalescing into one entry; `cancelResize` abandons the gesture and
records no history. Delete, cut, copy, paste, and duplicate are Scene-only
structural edits: they update the Scene and commit one entry, and the
editor-transient clipboard survives `setScene`.
`moveNodes` and `boxContains` are exported pure helpers for lower-level
integrations.

### Engine and renderer

`createEngine(container, editor, options?)` mounts an SVG engine, connects
pointer and wheel input, observes container resizing, and returns `{ editor,
render, destroy }`. Set `showGrid: false` to hide the screen-space dot grid.

`renderScene(snapshot, options?)` returns the complete SVG string for an editor
snapshot, including groups, edges, nodes, title, legend, background, grid, and
selection outlines. `attachInput` is exported for integrations that need to
connect input to their own rendering loop.

### Viewport helpers

The viewport is `{ zoom, tx, ty }`. `worldToScreen` and `screenToWorld` convert
coordinates; `panBy` and `panTo` move the camera; `zoomAt` preserves the world
point below a screen-space anchor; `visibleWorld` reports the visible world
rectangle; `fitToBounds` centers bounds in a screen size; and `resetView` returns the identity viewport (zoom 1 with zero translation);
it does not center content. Use `fitToBounds` when bounds and screen size are
available. `MIN_ZOOM` is `0.05` and `MAX_ZOOM` is `8`.

## React adapter

The React adapter is a separate entry point, so importing the core package does
not load React runtime code:

```tsx
import {
	Canvas,
	createEditor,
	useEditor,
	useShape,
} from '@kiyora/canvas/react';

function Diagram({ editor }: { editor: ReturnType<typeof createEditor> }) {
	return (
		<Canvas editor={editor} showGrid>
			<SelectedLabel />
		</Canvas>
	);
}

function SelectedLabel() {
	const editor = useEditor();
	const node = useShape(editor.getSelection()[0] ?? '');
	return <span>{node?.label ?? 'Nothing selected'}</span>;
}
```

`Canvas` renders an empty host during server rendering and mounts the DOM
engine in an effect on the client. The host `div` carries
`data-kiyora-canvas`, is focusable (`tabIndex={0}`), and should receive an
`aria-label` plus a visible focus style so app-owned keyboard shortcuts can
gate on canvas focus. The resize-handle chrome the renderer paints is
decorative (`aria-hidden="true"`): keyboard users resize through
`resizeBy` on the focused canvas rather than through the handles themselves.
`useEditor()` reads the nearest canvas editor, while `useShape(id)` subscribes
to one live, reference-stable `SceneNode` (or `undefined`).

## Development

From the repository root:

```sh
bun run --cwd packages/canvas typecheck
bun run --cwd packages/canvas test
bun run --cwd packages/canvas build
bun run --cwd packages/canvas verify:published
```

The published package contains only its built `dist` output. The source,
tests, and verification script are development files and are not included in
the npm tarball.
