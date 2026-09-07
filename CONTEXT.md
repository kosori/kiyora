# Kiyora

A diagram-as-code project: users write diagram code, and Kiyora parses it into shapes on an interactive hand-drawn canvas. This context covers the language, parsing, and the scene model the canvas edits.

## Language

**Kiyora DSL**:
The positional diagram language users write in `.kira` files. A dialect of the Koboyo diagram language (see `reference/koboyo/`), graph-family only in v1. Parsed by `@kiyora/dsl`.
_Avoid_: Koboyo, Koboyo DSL, Koyobo DSL

**Kira file**:
A text file containing Kiyora DSL source, with the `.kira` extension.
_Avoid_: `.kby` file, `.dsl` file

**Source**:
The Kiyora DSL text held in memory by the code panel and parsed on change. A Kira file is Source on disk; Source is Kira text in the editor.
_Avoid_: Buffer, Text, Document

**Save**:
Download the current Source as a Kira file. Save does not encode canvas-only Scene edits.
_Avoid_: Export

**Open**:
Replace the current Source with the Source read from a Kira file, then compile a new Scene. Open does not restore canvas-only Scene edits.
_Avoid_: Import

**Export**:
Download a portable visual representation of the current Scene as SVG or PNG. Export includes canvas-only Scene edits, but excludes the editor viewport and interface chrome.
_Avoid_: Save, Screenshot

**Diagram**:
The AST of one parsed Kira file — a union discriminated by `kind`. Renderers and the canvas consume Diagrams, never source text.
_Avoid_: Document, File

**Family**:
A diagram category with its own grammar and AST shape (architecture, flowchart, statemachine, orgchart, bpmn, sequence, erd, wireframe, mindmap, infographic, gitgraph, gantt, sankey, chart). Every Diagram has exactly one `kind`.
_Avoid_: Diagram kind, Type

**Variant**:
A flavor of graph-family diagram carried as `variant` on the `graph` Diagram (e.g. `flowchart`, `statemachine`). Flavor, not a separate grammar.
_Avoid_: Sub-type, Mode

**Statement**:
One line-oriented unit of Kiyora DSL: a node, edge, directive, or block.

**Directive**:
A top-level setting statement that creates no shapes — e.g. `title`, `direction`, `colorMode`, `legend`, `icons`.
_Avoid_: Option, Config

**Attribute**:
A positional or keyed modifier inside a statement's trailing `[ … ]` block — e.g. `Cache [cylinder, red, icon: cache]`. Positional attributes match the vocabulary; keyed ones use `key: value`. Recognized attributes that v1 cannot honor are dropped with an `attribute-ignored` warning.
_Avoid_: Property, Option, Param

**Palette color**:
One of the 9 v1 color tokens a statement accepts: blue, green, red, orange, violet, teal, pink, yellow, gray (plus `grey`/`purple` aliases). Anything else is an `unknown-color` warning until longform/hex resolution ships.
_Avoid_: CSS color, Hex color

**Diagnostic**:
A reported problem with Kiyora DSL source: `{ span, severity, code, message }`. An `error` means a statement was dropped; a `warning` means it parsed with a caveat. Parsing never fails.
_Avoid_: Parse error, Lint result

**Span**:
A `{ start, end }` range of 1-based `{ line, column }` positions locating an AST item or diagnostic within Kira source text.
_Avoid_: Range, Position

**Scene**:
The framework-agnostic, JSON-serializable shape state the canvas edits — positioned nodes, edges, and groups carrying semantic style tokens and source spans. Produced from a Diagram by `@kiyora/render`; edited by `@kiyora/canvas`. Selection is canvas-owned transient state, never part of the Scene.
_Avoid_: Document, Model, Layer

**Structural edit**:
A canvas edit that changes the Scene's membership — delete, cut, copy, paste, or duplicate of nodes. One-way and Scene-only: it never writes back to Source, and the next Compile resets structure to what Source declares.
_Avoid_: Write-back, Mutation

**Compile**:
The pure, DOM-free `@kiyora/render` transformation of a Diagram into a Scene (layout + assembly). Deterministic: the same Diagram always compiles to the same Scene.
_Avoid_: Layout, Build

**Editor**:
The framework-agnostic state core of `@kiyora/canvas`: owns the Scene, Viewport, selection, and History, and exposes actions plus a subscribe/getSnapshot contract. DOM-free and React-free.
_Avoid_: Store, Canvas engine, Document model

**Engine**:
The DOM binding of `@kiyora/canvas`: mounts the SVG, wires pointer/resize input, and re-renders on Editor change.
_Avoid_: Renderer, Mount

**Viewport**:
The camera over world coordinates — `{ zoom, tx, ty }`, mapping world↔screen. Panning and zoom mutate it; selection and History never include it.
_Avoid_: Camera, Transform

**Wobble overlay**:
A deterministic, display-only freehand outline drawn above clean Scene geometry to give the canvas a hand-drawn appearance. It does not affect hit-testing, selection, layout, or export.
_Avoid_: Rough geometry, Random shape, Raster stroke

**History**:
The Editor's two stacks of Scene snapshots (undo/redo). A drag coalesces into a single entry; selection and Viewport are never recorded.
_Avoid_: Undo stack, Temporal

**Kiyora packages**:
`@kiyora/dsl` parses Kiyora DSL text into Diagrams and diagnostics; `@kiyora/render` compiles Diagrams into Scenes and projects Scenes to SVG; `@kiyora/canvas` edits Scenes in the browser; `@kiyora/web` is the product-shaped application.

**Actor**:
A participant in a sequence diagram, represented visually by a header shape and a descending lifeline.
_Avoid_: Participant, Lifeline (when referring to the whole entity)

**Lifeline**:
The vertical line extending downwards from an Actor in a sequence diagram, representing the passage of time for that actor.
_Avoid_: Timeline

**Message**:
A communication from one Actor to another in a sequence diagram, drawn as a horizontal line between their lifelines.
_Avoid_: Call, Event, Signal

**State**:
A distinct condition or situation in a statemachine diagram, represented visually as a node (typically a rounded rectangle).
_Avoid_: Node, Step

**Compound state**:
A state that contains other nested states or transitions, authored using the `group` syntax in the DSL.
_Avoid_: Sub-machine, Nested state, State group

**Start state**:
The initial entry point of a statemachine, denoted by the `[*]` keyword acting as an edge source, rendered as a solid filled circle.
_Avoid_: Initial state, Entry point

**End state**:
The terminal exit point of a statemachine, denoted by the `[*]` keyword acting as an edge target, rendered as a double circle.
_Avoid_: Final state, Exit point

**Transition**:
A directed edge between two states in a statemachine, optionally carrying a label.
_Avoid_: Edge, Arrow, Event

**Entity**:
A structure in an ERD or class diagram (like a database table or a UML class), represented visually as a divided box containing fields and methods.
_Avoid_: Table, Class, Model

**Field**:
A structural property of an Entity, such as a database column or class attribute.
_Avoid_: Column, Property, Variable

**Method**:
A behavioral operation of an Entity, separated from fields by a horizontal divider.
_Avoid_: Function, Operation

**Relation**:
A connection between two Entities, carrying optional UML or crow's foot cardinality markers at its ends.
_Avoid_: Edge, Association, Link
