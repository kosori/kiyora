# Architecture

Kiyora is an offline whiteboard: one board, in this browser, drawn by hand, with a diagram-code panel arriving in v1.5. This document is the map to read before changing code — the package boundaries, the document model, the render seam, and the invariants every change must keep.

## Why the app runs a server

`apps/web` is a Next.js app that runs normally. It is not a static export, and `output: 'export'` must stay off: auth, an assistant proxy and MCP all need server routes, and static export forbids them.

**Offline means the editor makes no network request except fetching its own assets.** A test enforces it. In v1 the server does nothing but serve files.

## Workspaces

```
apps/web           the Next.js app: canvas, chrome, panels
packages/dsl       the source grammar: text to AST with diagnostics
packages/model     the board: schema, geometry, projection
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
  schemaVersion: number                             // migrations bump this
  id: string
  title: string
  createdAt: number
  updatedAt: number
  camera: { x: number; y: number; zoom: number }    // never in history
  settings: { theme: 'light' | 'dark' }
  shapes: Shape[]                                   // array index is paint order
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
  | ShapeBase & { kind: FigureKind }                                     // ~40 figures
  | ShapeBase & { kind: 'text' }
  | ShapeBase & { kind: 'sticky' }
  | ShapeBase & { kind: 'frame'; variant: FrameVariant; clip: boolean }
  | ShapeBase & { kind: 'group' }                                        // box derived
  | ShapeBase & { kind: 'connector'; from: Endpoint; to: Endpoint;
                  route: Route; start: Head; end: Head }
```

Containment is flat: a frame or a group is a shape, and its members name it through `parentId`. Reordering, z-order and reparenting are all the same operation on one array.

### Authored, not derived

Only authored state is stored. Group boxes, connector paths, text wrapping, hit-test geometry, selection, hover and drag state are all recomputed. A migration therefore only ever has to reason about something a person typed.

### Paint order

Paint order is array order: index 0 paints first. There is no `z` number, so a z-collision cannot exist. Reordering is a splice.

The camera and the selection live outside the document, in `editor`. Panning is never undoable and never triggers a save.

## The render seam

There is one walker and two backends, so the canvas and the exporter can never disagree:

```ts
// @kiyora/model
type Paint = {
  paths: { d: string; fill?: string; stroke?: string; strokeWidth?: number; dash?: number[] }[]
  text:  { runs: Run[]; x: number; y: number; size: number; align: Align }[]
  defs:  Def[]
  children: Paint[]
}

function paintShape(shape: Shape, ctx: PaintContext): Paint
function paintBoard(board: Board, ctx: PaintContext): Paint
```

- `model` turns `Paint` into an SVG **string**.
- `apps/web` turns the same `Paint` into **React elements**.

Neither the app nor `editor` computes geometry, colour or text position.

`PaintContext` carries only what `model` cannot obtain by itself: the theme and the **measurer**.

### The measurer

Text metrics need a DOM, and `model` must not have one, so measurement is injected. The app passes a canvas-2D measurer; tests pass a deterministic fake. Both the canvas and the exporter therefore wrap text identically.

`editor` injects the same measurer for hit-testing, so a click lands where the text is drawn.

### Wobble

The hand-drawn overlay is a pure, seeded function of the shape, produced inside `paintShape`. Export therefore keeps the hand-drawn look by default — the export is the drawing the user saw. A `clean` flag for true geometry is a later addition.

## Editing

One gesture produces exactly one history entry.

- A drag opens a transaction and commits once on pointer-up; thirty pointer moves are one undo.
- Consecutive nudge keys coalesce until the run stops or the selection changes.
- A text edit commits on blur or Escape.
- Escape restores the transaction's before-picture and pushes nothing.
- History is bounded at 200 entries and lives in memory. Autosave covers the document, so a persisted history would only add a second format to migrate.
- Redo clears on any new gesture.
- Commit notifies subscribers. The toolbar's undo state is read from the notification, never polled.

## Persistence

IndexedDB is primary, localStorage the fallback, memory the last resort. Autosave is debounced roughly 500 ms after the last change, with a flush on `pagehide` and `visibilitychange`.

A migration chain keys off `schemaVersion`: ordered pure functions, each with a fixture. Before migrating, the previous payload is kept as a recovery snapshot. Unreadable data is quarantined rather than overwritten. Storage faults are a typed value — `quota`, `blocked`, `corrupt`, `unavailable` — surfaced in the status bar. A second tab warns instead of clobbering. All keys are namespaced `kiyora:`.

## Invariants

Every change must keep these. Each one is falsifiable, and each exists because a real attempt broke it.

1. **Tests assert paint and behaviour.** Never element counts, never attribute presence. A test that asserts an element exists proves nothing about what a user sees.
2. **One schema.** Types derive from it. No hand-mirrored types, and no `as unknown as` across a package boundary.
3. **No borrowed measurements.** No geometry, layout constant or default position is derived by measuring another product's rendering.
4. **CI from the first commit**, and the end-to-end config proves which application it tested.
5. **Offline by construction.** Every request that is not to localhost is aborted, by a test.
6. **The export path sees only a board.** Nothing display-only can reach an artifact.
7. **No silent failures.** Every user-visible failure has a surface.
8. **One gesture, one history entry.** Camera and selection stay outside history.
9. **Only authored state is stored.**
10. **New source files stay under the size budget** (400 lines; tests 600). `packages/dsl/src` is vendored and exempt.

## Where things live

| Concern | Home |
| --- | --- |
| Schema, shape union, migrations, serialization | `packages/model/src/board/` |
| Figure geometry, palette, style resolution | `packages/model/src/paint/` |
| Wobble | `packages/model/src/paint/wobble.ts` |
| SVG projection | `packages/model/src/projection/` |
| Text runs, wrapping, measurement protocol | `packages/model/src/text/` |
| Board file (`.kyr.json`) | `packages/model/src/file/` |
| Store, selection, commands | `packages/editor/src/` |
| Gestures, transactions, history | `packages/editor/src/history/` |
| Hit-testing, snapping | `packages/editor/src/geometry/` |
| Persistence, autosave, faults | `packages/editor/src/persistence/` |
| React adapter | `packages/editor/src/react/` |
| Canvas surface, tool rail, inspector | `apps/web/app/`, `apps/web/components/` |
| Parser, diagnostics, vocabulary | `packages/dsl/src/` |

The exact file names are the implementer's to choose. The boundary is not.
