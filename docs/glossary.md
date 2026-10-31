# Kiyora

An offline whiteboard for diagrams, notes and slides. Draw by hand, or type a diagram as code. The board lives in this browser; nothing leaves the machine.

## Language

### The board

**Board**:
The document of record: one ordered list of shapes, plus its files, deck, camera, settings and schema version. Its id names the same board in every copy.
_Avoid_: Document, diagram, scene, file

**Shape**:
One item on the board — a figure, text, sticky, frame, group, icon, image, ink, table, chart or connector. Its position and style are authored; its paint is derived.
_Avoid_: Element, object, node, item

**Paint**:
The render-ready description of a shape: paths, an optional raster, text runs, its children, and the clip its members are held inside. Pure, and the only thing a renderer consumes.
_Avoid_: Render model, SVG model, draw instructions

**Palette**:
The nine colours a board may use, and the three fill styles. Any other colour snaps to the nearest palette hue.
_Avoid_: Theme, swatches, colour set

**Theme**:
A board's light or dark setting. It is authored, it travels in the board file, and it decides the colour of every exported artifact.
_Avoid_: Appearance, colour scheme, mode

**Appearance**:
The chrome's light, dark or system setting. `system` follows the OS until a person picks; the choice is a preference of this browser, never stored in a board, and never changes what an export looks like.
_Avoid_: Theme, skin

**Camera**:
Where the board is being looked at from: x, y and zoom. The board stores only a snapshot the last save wrote; the live camera is in the view, outside undo, so panning is never undoable and never autosaves.
_Avoid_: Viewport, scroll position, pan

**Canvas**:
The surface that shows the board, with the tool rail around it.
_Avoid_: Board, viewport, stage

**Anchor**:
The point on a shape where a connector attaches, named by edge and fraction, or auto-picked when the connector does not name one.
_Avoid_: Port, junction, endpoint

**Connector**:
A shape that draws a line between two endpoints, each bound to an anchor or standing free at a coordinate.
_Avoid_: Edge, link, arrow, line

**Frame**:
A shape that holds other shapes and can be presented as a slide. Carries a variant: plain, phone, tablet, browser or window.
_Avoid_: Container, artboard, section

**Group**:
A shape that holds other shapes so they move together. Its box is derived from its children.
_Avoid_: Container, folder, cluster

**Sticky**:
A shape kind: a coloured note with centred text whose height fits its content until a person resizes it.

**Control**:
A figure kind that draws one wireframe UI control — button, input, slider, tabs and the rest — as paths on its authored box, wearing the board's palette, stroke width and corner rather than a picture of a control.
_Avoid_: Widget, component, UI element

**Icon**:
A shape kind (`icon`): one figure from the 150-name dataset, named by `name` and drawn in its authored box. The paths are generated, committed and loaded on demand, so a board stores the name and never the paths.
_Avoid_: Glyph, symbol, emoji, sticker

**Image**:
A shape kind (`image`): a PNG or JPEG carried inside the board file and drawn in its authored box. It names one entry in the board's files by `fileId`, so placing the same picture twice costs one payload.
_Avoid_: Picture, bitmap, photo

**Ink**:
A shape kind (`ink`): a freehand stroke drawn as one path from authored points, each a fraction of the box with the pressure the pen reported — none when the device reported none. A pen lays opaque ink; a highlighter lays a wider translucent band that paints behind its siblings.
_Avoid_: Scribble, mark, annotation, drawing

**Table**:
A shape kind (`data-table`): rows and columns of typed cells inside its authored box, with an authored header row. The columns and the row count are authored; every cell size is derived by dividing the box evenly, so resizing a table scales the whole grid and no cell size is stored. An empty table paints its authored box and nothing else. The wireframe `table` figure is a Control, not this kind.
_Avoid_: Grid, spreadsheet, data grid

**Chart**:
A shape kind (`chart`): a series of numbers, the category each belongs to, and the palette colours the marks cycle through, drawn as one of eight kinds — bar, column, line, area, pie, donut, scatter or sparkline. The numbers are authored, so replacing them repaints a chart rather than replacing a drawing. The kind is a variant, so one chart can become another without losing its series.
_Avoid_: Graph, plot, widget

**File**:
One raster inside a board's files: base64 PNG or JPEG bytes, the type they decode as, and their decoded size, keyed by the content hash of the bytes. Import downscales it once, and a per-image cap keeps one picture from consuming the whole board.
_Avoid_: Blob, asset, attachment

**Files**:
A board's map of files, keyed by content hash. A board file is still one document when it holds them; nothing is fetched and nothing lives beside the board.
_Avoid_: Blobs, assets, attachments

**Inspector**:
The right-hand panel that edits the selection's style, text style, connector routing and arrangement, plus the controls a frame, table or chart needs, the lock, and the board's theme.
_Avoid_: Properties panel, sidebar

**Tool rail**:
The left column of tool buttons.
_Avoid_: Toolbar, palette

### Editing

**Gesture**:
One continuous user interaction — a drag, a resize, a run of nudges, a single text edit. Produces exactly one history entry.
_Avoid_: Action, command, operation, interaction

**Transaction**:
The open span of one gesture. It records the before-picture, mutates freely, and commits once.
_Avoid_: Batch, unit of work, session

**History**:
The bounded, in-memory undo and redo stack of committed gestures.
_Avoid_: Undo stack, journal

**Marquee**:
A drag started on empty canvas that selects every shape it covers.

**Handle**:
A grab point drawn around a selection: eight for resize, one for rotate.

### Code

**Source**:
The diagram code attached to a frame. An input: applying it stamps shapes, and it is marked stale when those shapes are edited afterwards.
_Avoid_: Code, script, DSL text, snippet

**Stale**:
A frame's source after the frame's shapes have been edited by hand. Regenerating replaces the frame's shapes as one gesture.
_Avoid_: Dirty, out of date, unsynced

**Pending**:
The source text of a frame after it has been edited and before it has been applied. The board has not drifted from the source; the source has drifted from the board.
_Avoid_: Stale, dirty, unsaved

**Family**:
One diagram kind the source language can express — architecture, bpmn, flowchart, orgchart or statemachine.

**Diagnostic**:
A non-fatal note from the parser about one line of source: a warning (the line is ignored) or an error (the line is unparsed). The build always continues.
_Avoid_: Error, lint, problem

### The library and the account

**Library**:
Every board this browser holds, each with its own record.
_Avoid_: Board list, dashboard, workspace

**Local copy**:
A board as stored in this browser. It is the copy a person edits.
_Avoid_: Draft, instance, unsynced board

**Remote copy**:
A board as stored on the server for an account.
_Avoid_: Cloud board, server board

**Linked**:
A board whose local copy and remote copy are kept in step by sync.
_Avoid_: Synced board, connected board

**Account**:
The owner a remote copy belongs to. Optional: the editor and the library work without one.
_Avoid_: User, profile, login

**Save**:
Writing the local copy shortly after it changes.
_Avoid_: Sync, upload, persist

**Sync**:
Writing the remote copy from the local one, refused when the remote copy has moved past the revision the local copy was built on.
_Avoid_: Save, upload, backup, publish

**Revision**:
The server's count of how many times a remote copy has changed. A sync names the revision its local copy was built on.
_Avoid_: Version, etag, commit

**Conflict**:
A sync refused because the remote copy is at a later revision than the local copy was built on. It is resolved by a person, never by merging.
_Avoid_: Collision, clash, merge

**Recovery snapshot**:
The bytes kept beside a board before a write replaces them: a migration, or taking the remote copy in a conflict. They stay reachable as a `kiyora:boards:<id>:snapshot` key and, for a conflict, as a downloadable board file.
_Avoid_: Backup, trash, history

**Share link**:
An unlisted, revocable address that shows one board read-only.
_Avoid_: Public link, permalink, guest link

**Preview**:
A small picture of a board, derived from the board's paint and kept beside its record so the library lists without opening it.
_Avoid_: Thumbnail, snapshot

**Sync limit**:
The largest board that can be synced. A board above it is still saved locally, and says so.
_Avoid_: Cloud cap, size cap

### Storage and files

**Autosave**:
Writing the board to local storage shortly after the last change.

**Migration**:
A pure function that lifts a board from one schema version to the next.

**Quarantine**:
Parking unreadable stored data under a separate key, so a corrupt board is never overwritten by a fresh one.

**Fault**:
A typed storage problem shown to the user: quota, blocked, corrupt or unavailable.

**Board file**:
A single `.kyr.json` file holding one board, byte-identical when saved and reopened.
_Avoid_: Export, backup, snapshot

### Presentation

**Deck**:
A board's ordered list of slides. Empty when the board has no slides.

**Slide**:
A frame with a deck entry. It carries notes, and can be skipped.

**Present**:
Fullscreen playback of the deck in the same window, with an optional notes and timer overlay.
