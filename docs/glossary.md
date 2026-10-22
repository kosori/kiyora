# Kiyora

An offline whiteboard for diagrams, notes and slides. Draw by hand, or type a diagram as code. The board lives in this browser; nothing leaves the machine.

## Language

### The board

**Board**:
The document of record: one ordered list of shapes, plus its deck, camera, settings and schema version.
_Avoid_: Document, diagram, scene, file

**Shape**:
One item on the board — a figure, text, sticky, frame, group or connector. Its position and style are authored; its paint is derived.
_Avoid_: Element, object, node, item

**Paint**:
The render-ready description of a shape: paths, fills, strokes and text runs. Pure, and the only thing a renderer consumes.
_Avoid_: Render model, SVG model, draw instructions

**Palette**:
The nine colours a board may use, and the three fill styles. Any other colour snaps to the nearest palette hue.
_Avoid_: Theme, swatches, colour set

**Theme**:
A board's light or dark setting. It is authored, it travels in the board file, and it decides the colour of every exported artifact.
_Avoid_: Appearance, colour scheme, mode

**Appearance**:
The chrome's light or dark setting. It is a preference of this browser, never stored in a board, and never changes what an export looks like.
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

**Inspector**:
The right-hand panel that edits the selection's style, text style and connector routing.
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
One diagram kind the source language can express — flowchart, sequence, mindmap and the rest.

**Diagnostic**:
A non-fatal note from the parser about one line of source: a warning (the line is ignored) or an error (the line is unparsed). The build always continues.
_Avoid_: Error, lint, problem

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
