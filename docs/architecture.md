# Architecture

Kiyora is an offline whiteboard: a library of boards, in this browser, drawn by hand, with a diagram-code panel. This document is the map to read before changing code — the package boundaries, the document model, the render seam, and the invariants every change must keep.

## Why the app runs a server

`apps/web` is a Next.js app that runs normally. It is not a static export, and `output: 'export'` must stay off: auth, an assistant proxy and MCP all need server routes, and static export forbids them.

**Offline means the editor makes no network request except fetching its own assets.** Every end-to-end spec inherits one guard that aborts anything else; a spec that needs a network double opts out per test, never per file. In v1 the server does nothing but serve files.

## Workspaces

```
apps/web           the Next.js app: canvas, chrome, panels
packages/dsl       the source grammar: text to AST with diagnostics
packages/model     the board: schema, geometry, paint, projection and export
packages/editor    the engine: store, gestures, persistence
tooling/typescript shared tsconfigs
```

Dependencies run one way and never backwards:

```
dsl  ←  model  ←  editor  ←  apps/web
```

- A package never imports from `apps/`.
- `model` is React-free and DOM-free. `editor` is DOM-free, with a thin React adapter under `editor/react`.
- Packages export TypeScript source directly. There is no package build step, and therefore no stale `dist` to rebuild before the app sees a change.

## The document

`@kiyora/model` owns one zod schema, and every other type in the project is inferred from it. Nothing hand-mirrors it.

```ts
type Board = {
  schemaVersion: 3                                   // migrations bump this
  id: string
  title: string
  createdAt: number
  updatedAt: number
  camera: { x: number; y: number; zoom: number }    // snapshot autosave writes from the view
  settings: { theme: 'light' | 'dark' }
  shapes: Shape[]                                   // array index is paint order
  files: Record<string, { mime: string; dataURL: string; bytes: number }>
                                                    // rasters, keyed by content hash
  deck: Slide[]                                     // empty when there are no slides
}

type ShapeBase = {
  id: string
  parentId: string | null                           // membership in a frame or group
  x: number; y: number; w: number; h: number
  rotation: number                                  // degrees, render-only
  opacity: number
  locked: boolean
  style: Style
  text?: string
  textStyle?: TextStyle
}

type Shape =
  | ShapeBase & { kind: FigureKind }                                     // 56 figures
  | ShapeBase & { kind: 'text' }
  | ShapeBase & { kind: 'sticky' }
  | ShapeBase & { kind: 'frame'; variant: FrameVariant; clip: boolean }
  | ShapeBase & { kind: 'group' }                                        // box derived
  | ShapeBase & { kind: 'connector'; from: Endpoint; to: Endpoint;
                  route: Route; start: Head; end: Head }
  | ShapeBase & { kind: 'icon'; name: string }                           // paths from the dataset
  | ShapeBase & { kind: 'image'; fileId: string }                        // bytes in `files`
  | ShapeBase & { kind: 'ink'; mode: InkMode; points: InkPoint[] }       // freehand stroke
  | ShapeBase & { kind: 'data-table'; columns: number; headerRow: boolean;
                  rows: string[][] }                                     // cells are authored text
  | ShapeBase & { kind: 'chart'; variant: ChartKind; series: number[];
                  labels: string[]; palette: PaletteColour[] }           // authored numbers
```

Containment is flat: a frame or a group is a shape, and its members name it through `parentId`. Reordering, z-order and reparenting are all the same operation on one array.

### Authored, not derived

Only authored state is stored. Group boxes, connector paths, text wrapping, hit-test geometry, selection, hover and drag state are all recomputed. A group's stored box is a placeholder: the schema requires geometry on every shape, so a group carries a zero box that bounds never read, and its real box is derived from its children. A migration therefore only ever has to reason about something a person typed.

### Paint order

Paint order is array order: index 0 paints first. There is no `z` number, so a z-collision cannot exist. Reordering is a splice.

The selection lives outside the document, in `editor`. The camera does too while a board is open: the board's `camera` is only the snapshot the last save wrote from the view, and undo never restores the view. Panning is therefore never undoable and never triggers a save.

`updatedAt` is stamped the same way. It lives in the document header because a file carries it, but the engine never moves it: autosave writes the save time beside the camera at serialization time. A history entry therefore cannot hold a different save time, and undo cannot put an older one back. `createdAt` is stamped once, when the board is created.

## The library

A browser holds a library: many boards, each with its own record. A board's id is minted in `apps/web` with `crypto.randomUUID()` before anything is stored; `editor` and any server only ever read it. Two boards therefore never share an id, and a board exists with the network off.

### Routes

`/` lists the library, newest change first, and offers New board. `/b/<id>` opens that board. The editor is keyed by the id, so moving between boards cannot reuse the previous engine, history or autosave. An id the library does not hold is reported as not found; it is never created by opening its address. Next 16 route params arrive as a Promise, so the page awaits `params` before reading `id`.

### Keys

```
kiyora:library                     the record: { version: 1, boards: LibraryEntry[] }
kiyora:boards:<id>                 one board's payload
kiyora:boards:<id>:snapshot        the bytes a migration replaced
kiyora:boards:<id>:quarantine      bytes that will not read
```

Every board's storage is a `BoardStorage` over those keys, handed out by the library per id, so autosave still takes a single board's port and a save for one board can never touch another's bytes. IndexedDB, localStorage and memory all implement the same key scheme.

### The record is a cache

The record carries `{ id, title, updatedAt }` and never the board itself, so the list opens no payload. A write stores the payload first, then refreshes the record with the same `updatedAt` in the same save. If the record is missing or unreadable, `createLibrary().entries()` scans the `kiyora:boards:` prefix, parses each payload once and writes the record back; a payload that will not parse is quarantined under that board's own key and skipped, so one damaged board cannot hide the rest.

### One upgrade

IndexedDB keeps the database `kiyora` and the out-of-line-keyed store `boards`, and moves to version 2. In `onupgradeneeded` the single board at `kiyora:board` is adopted under its stored id, its snapshot and quarantine move beside it, and the legacy keys are deleted only after the record naming it has been written. The whole upgrade is one transaction, so a record that cannot be written leaves the board where it was. A second upgrade with no legacy keys changes nothing.

A storage fault is reported by the board that caused it; the record is not consulted for the fault, so the rest of the library still lists and opens.

### Rename, duplicate and delete

A rename writes the payload with the new name and the new `updatedAt`, then the record, so the two cannot disagree after a reload. The editor's title field commits through the same rename and adopts the name without a history entry. A duplicate keeps the payload's shapes, files, deck and camera under an id minted in the browser, resets both times, and names itself `<title> copy`. Delete removes the payload, the snapshot, the quarantine and the record entry, after a confirm that names the board.

## The render seam

There is one walker and two backends, so the canvas and the exporter can never disagree:

```ts
// @kiyora/model
type PaintPath = {
  d: string
  fill?: string; stroke?: string; strokeWidth?: number
  dash?: number[]
  transform?: string   // an icon's paths are authored in the library's square
}

type Paint = {
  paths: PaintPath[]
  image?: PaintImage    // the raster an image shape draws
  text?: PaintText[]    // absent when the shape carries no label
  children: Paint[]
  clip?: string         // the box a frame clips its members to
  shapeId?: string      // the shape this node came from; the board's node carries none
}

function paintShape(shape: Shape, ctx: PaintContext): Paint
function paintBoard(board: Board, ctx: PaintContext): Paint
```

- `model` turns `Paint` into an SVG **string**.
- `apps/web` turns the same `Paint` into **React elements**.

Neither the app nor `editor` computes geometry, colour or text position.

`PaintContext` carries only what `model` cannot obtain by itself: the board's `theme`; the `measure` function text needs; the `view` a live canvas shows, absent for an export; the `files` an image names; and the `icons` an icon names. A missing payload degrades to the authored box rather than an empty hole, and a missing view paints the whole board. A connector cannot be painted from itself — its path is resolved from the shapes its ends name — so `paintBoard` is the way to paint one.

### The measurer

Text metrics need a DOM, and `model` must not have one, so measurement is injected. The app passes a canvas-2D measurer; tests pass a deterministic fake. Both the canvas and the exporter therefore wrap text identically. A shape that carries a label and reaches the walker with no measurer throws rather than painting nothing.

`editor` injects the same measurer for hit-testing, so a click lands where the text is drawn.

### Clean geometry

Every figure, frame, sticky and connector paints its authored geometry exactly once. Nothing is traced over it, so the canvas and an export carry the same lines, and the seed that once made a shape redraw identically has nothing left to displace.

The hand-drawn character comes from the typeface, which is set on every label and vendored with its licence. Geometry stays exact.

Reduced motion is the app's decision, not the model's. The only motion left to suppress is the chrome's transitions, so `prefers-reduced-motion: reduce` shortens those and does not touch the board, which never moves.

## Editing

One gesture produces exactly one history entry.

- A drag opens a transaction and commits once on pointer-up; thirty pointer moves are one undo.
- Consecutive nudge keys coalesce until the run stops or the selection changes.
- A text edit opens a transaction when the overlay appears and commits once on blur.
- Escape restores the transaction's before-picture and pushes nothing.
- History is bounded at 200 entries and lives in memory. Autosave covers the document, so a persisted history would only add a second format to migrate.
- Redo clears on any new gesture.
- Commit notifies subscribers. The toolbar's undo state is read from the notification, never polled.

### The keymap

One keymap declares every binding, and the in-app shortcut reference is generated from it, so the dialog and the handler cannot disagree. Three things live on a binding besides its key and command:

- A **mode** — `edit`, `present` or `navigate`. The three share one keymap, so a key pressed while presenting cannot run an editing command behind the slide, and an arrow pressed while navigating steps the selection spatially instead of nudging it.
- A **modifier rule** per modifier — `required`, `forbidden` or `ignored`. Two bindings on one key differ by declaring the modifier, not by spelling the combination into the key.
- A **focus** rule — `canvas` when the binding only applies while the board holds focus, so Enter on a button is still a button press.

Tests fail if a binding has no row in the reference, if a row names a command the keymap cannot key, or if two bindings claim one chord in one mode.

## Persistence

IndexedDB is primary, localStorage the fallback, memory the last resort. Each is a per-board store under the library's key scheme. Autosave is debounced roughly 500 ms after the last change, with a flush on `pagehide` and `visibilitychange`.

A migration chain keys off `schemaVersion`: ordered pure functions, each with a fixture. Before migrating, the previous payload is kept as a recovery snapshot. Unreadable data is quarantined rather than overwritten. Storage faults are a typed value — `quota`, `blocked`, `corrupt`, `unavailable` — surfaced in the status bar for the board they concern. A second tab warns instead of clobbering. All keys are namespaced `kiyora:`.

## Invariants

Every change must keep these. Each one is falsifiable, and each exists because a real attempt broke it.

1. **Tests assert paint and behaviour.** Never element counts, never attribute presence. A test that asserts an element exists proves nothing about what a user sees.
2. **One schema.** Types derive from it. No hand-mirrored types, and no `as unknown as` across a package boundary.
3. **No borrowed measurements.** No geometry, layout constant or default position is derived by measuring another product's rendering.
4. **CI from the first commit**, and the end-to-end config proves which application it tested.
5. **Offline by construction.** Every request that is not to localhost is aborted, by a test.
6. **The export path sees only a board.** Nothing display-only can reach an artifact.
7. **No silent failures.** Every user-visible failure has a surface.
8. **One gesture, one history entry.** Undo never restores the camera, the selection, the save time or the board's name.
9. **Only authored state is stored.** The camera snapshot and the save time are written by the save, never edited as state.
10. **New source files stay under the size budget** (400 lines; tests 600). `packages/dsl/src` is vendored and exempt.

## Where things live

| Concern | Home |
| --- | --- |
| Schema, shape union, migrations, serialization | `packages/model/src/board/` |
| Figure, frame, image, ink, table and chart paint; palette, style resolution | `packages/model/src/paint/` |
| The icon dataset, its lookup and the square every icon is authored in | `packages/model/src/icons/`, `scripts/icons.ts` |
| Layered layout from a diagram's direction | `packages/model/src/layout/` |
| SVG projection | `packages/model/src/projection/` |
| SVG export: document, byte cap, safety | `packages/model/src/export/` |
| Text runs, wrapping, measurement protocol | `packages/model/src/text/` |
| Board file (`.kyr.json`) | `packages/model/src/file/` |
| Store, selection, commands | `packages/editor/src/` |
| Gestures, transactions, history | `packages/editor/src/history/` |
| Keymap, shortcut reference | `packages/editor/src/keymap.ts` |
| Hit-testing, snapping | `packages/editor/src/geometry/` |
| Persistence, autosave, faults | `packages/editor/src/persistence/` |
| Library record, keys and legacy adoption | `packages/editor/src/persistence/library.ts`, `storage.ts` |
| Browser store: IndexedDB, fallbacks and the v2 upgrade | `apps/web/lib/board-storage.ts` |
| Library list and the board route | `apps/web/app/`, `apps/web/components/library/`, `apps/web/components/editor/board-route.tsx` |
| React adapter | `packages/editor/src/react/` |
| Canvas surface, tool rail, inspector | `apps/web/app/`, `apps/web/components/` |
| Parser, diagnostics, vocabulary | `packages/dsl/src/` |

The exact file names are the implementer's to choose. The boundary is not.
