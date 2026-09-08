# Kiyora roadmap

The product is a hand-drawn diagram canvas that runs from a tiny text DSL. This
file tracks the shape of the work — what's shipped, what's next, and what's
explicitly out of scope. The phasing follows the reference (`reference/koboyo/`)
but adapts it to our own product priorities: **local features first, online
features second, AI/MCP/billing last**.

Legend: ✅ shipped · 🟡 in progress · ⏳ not started · 🚫 out of scope

---

## Phase 0 — Consolidate (done)

Cleanup of the reference material and the public-private split.

- ✅ Repo scaffold (Bun + Turborepo + TanStack Start + Biome + Ultracite)
- ✅ Reference material moved under `reference/koboyo/` (gitignored; not shipped)
- ✅ Single domain glossary in `CONTEXT.md`
- ✅ Triage labels and issue-tracker conventions under `docs/agents/`

## Phase 1 — Canvas MVP (v1) (done)

Diagram code → hand-drawn canvas → typed text editing. The "kernel" of the
product: parse `.kira`, compile to a positioned scene, render and edit it.

- ✅ `@kiyora/dsl` — graph-family parser (architecture, flowchart, bpmn,
  orgchart, statemachine), tolerant diagnostics, full source spans
- ✅ `@kiyora/render` — pure layered layout, style, shape geometry, SVG
  projection for the graph family (ADR-0002; elkjs is the documented upgrade
  path)
- ✅ `@kiyora/canvas` — viewport, scene, input, hit-testing, undo/redo;
  DOM-free Editor + SVG-rendering Engine + thin React adapter (ADR-0003)
- ✅ `@kiyora/web` — split-pane code panel + canvas, 250 ms debounced live
  recompile + `⌘/Ctrl+Enter` for explicit compile, toolbar (undo/redo/fit/
  reset + zoom %), selection → line scroll, one-shot fit-to-view on mount,
  localStorage autosave under `kiyora:source`
- ✅ Tooling: shared TypeScript, Tailwind v4 theme, GitHub CI matrix (lint,
  build, typecheck, test), `verify:published` smoke tests on `render` and
  `canvas`
- ✅ Hand-drawn font: `Balsamiq Sans Neue` (OFL 1.1, `nilbuild/balsamiq-sans-neue`)
  bundled under `apps/web/public/fonts/`, exposed as `--font-balsamiq`
- ✅ Quality-of-life fixes from the v1 test pass: synchronous Reset, strict
  `fitToBounds`
- ⏳ Graduated grid density at zoom bands (70/30/15/8%) and node-label text
  fade below 25% zoom (not shipped — see `packages/canvas/src/renderer.ts`)

**Test posture:** 236/236 tests pass. `bun run check` and `bun run typecheck` clean. `bun run build` clean.

## Phase 1.x — Local product completeness (v1.x)

The current product is a "type code, see a diagram" demo. v1.x turns it into
"type code, edit, save, export." Order chosen for leverage.

### A1 — File I/O + export (✅ done)

Goal: a user can take their work out of the app and bring new work in.

- ✅ Save Source as `.kira` (browser download via anchor `download` attr)
- ✅ Load `.kira` from disk (browser file picker)
- ✅ Export SVG (high-fidelity, with embedded font data-URIs)
- ✅ Export PNG (SVG → `<img>` → Canvas → blob, 2× DPI, transparent, size-capped)
- 🚫 Export PDF (deferred; rare format, awkward UX without a dep)
- ✅ Default filename: `title Foo` → `foo.kira`; fallback `diagram.kira`
- ✅ Toolbar gains a top-left "File" group: Save / Open / Export PNG / Export SVG
- ✅ Keyboard: `⌘/Ctrl+S` (Save), `⌘/Ctrl+O` (Open) — `preventDefault` to
  bypass the browser's save-page dialog
- ✅ Code-panel footer hint gains the keyboard shortcuts
- ✅ Source persisted across visits under `kiyora:source`

Test plan:

- `apps/web/src/editor/io/io.test.ts` — ~6 unit tests (download/load/export-svg/
  export-png/filename, two cases each)
- `apps/web/src/editor/editor-page.test.tsx` — +3 integration tests (Save click,
  Open click, ⌘+S bypasses browser save)

Architectural constraints: pure functions where possible; DOM-coupled pieces
(`pickKiraFile`, `renderSvgToPng`) isolated to a single module to keep test
surface small. The font is loaded by the page's CSS, so SVG-to-PNG must run
after `document.fonts.ready`; the export button is disabled until then.

### A2 — Canvas interaction completeness (✅ done)

The canvas now feels like an editor rather than a viewer. A2 shipped the
smallest interaction set needed for structural edits, precise placement, and
shape resizing while keeping Source as the structural authority.

- ✅ Marquee selection with plain replace and Shift-add
- ✅ Multi-drag with uniform movement of the selected nodes
- ✅ Copy / cut / paste / duplicate / delete, including internal edge remapping
- ✅ Delete removes incident edges; structural edits are Scene-only and undoable
- ✅ Snap to an always-on 8-pixel screen-space grid during drag and nudge
- ✅ Arrow-key nudge by world pixel and Shift+Arrow nudge by grid step, with
  coalesced History entries
- ✅ Render-only rotation on `SceneNode`, with layout and hit-testing remaining
  axis-aligned
- ✅ Eight resize handles with a 40×24 minimum and edge re-routing from current
  node bounds
- ✅ Focus-gated canvas keyboard shortcuts and an accessible Alt+Arrow resize
  path
- ✅ Cancel-safe resize gestures that restore the pre-gesture Scene without
  adding History
- 🚫 Group / lock, z-order, freehand draw, pinch zoom (later)

Architectural note: rotation is a _render-only_ concern (layout unchanged).
The Scene type carries the required field, while layout, hit-testing,
selection outlines, and resize handles remain axis-aligned.

Development note: `dev:web` resolves workspace packages through their compiled
`dist` output. Rebuild `@kiyora/render` and `@kiyora/canvas` after source changes,
or use a package watch workflow, before checking new canvas behavior in the
browser.

### A3 — Hand-drawn aesthetic completion (✅ done)

Closes the gap to Koboyo's "looks hand-drawn" feel on top of the font.

- ✅ Deterministic wobble overlays on every supported node shape and compound
  shape component via `perfect-freehand` (`getStroke` → `getSvgPathFromStroke`)
  with `size 5, thinning 0, smoothing 0.5, streamline 0.32`
- ✅ Wobble on visible edge paths and group frames, including preserved edge
  dash semantics and closed group-frame contours
- ✅ Clean geometry remains underneath the display-only overlays and continues
  to own layout, hit-testing, selection, editing, and rotation alignment
- ✅ Wobble is opt-in for render projections and explicitly enabled by the
  product canvas; overlays remain deterministic, pointer-transparent, and
  stable across pan, zoom, and re-rendering
- ✅ SVG and PNG exports remain clean by default
- 🚫 Stroke rasterization for export (clean paths are the export contract; the
  wobble is a visual overlay)

### A4 — Sequence family (✅ done)

The sequence diagram family is complete and shipped across the full pipeline (DSL
parser, bespoke mathematical layout, SVG projection, wobble overlay, and read-only
canvas guard).

- ✅ Tolerant parser with `sequence` family keyword and `SequenceDiagram` AST variant
- ✅ Explicit and implicit actor declarations (`Actor A` or inferred from messages)
- ✅ Forward message arrows (`->` solid, `-->` dashed reply) with horizontal routing and arrowheads
- ✅ Fixed-grid mathematical layout in `@kiyora/render` (200px actor columns, 60px message rows)
- ✅ Dashed lifelines extending from actor headers down to below the final message with bottom padding
- ✅ Hand-drawn wobble overlays applied to straight lifelines and message paths via `perfect-freehand`
- ✅ Non-fatal `self-edge` diagnostic warning for self-messages (`A -> A`)
- ✅ Read-only canvas protection (disables dragging, resizing, and structural mutations for sequence scenes)
- ✅ Code-review refinements (Issue 04):
  - Standards: shared edge markup generator in `projection.ts`, `expandBounds` helper for bounds calculation, and semantic token parsing in `sequence.ts`
  - Spec: standard snapshot testing in `index.test.ts`, strict forward-arrow scope (`->`, `-->`) without reverse or multi-hop chaining, removal of dead bidirectional checks, and non-greedy actor parsing preventing invalid text from spawning ghost actors
- ⏳ Sequence advanced features (deferred to follow-up increment): activations, notes, blocks/frames (`loop`, `alt`, `opt`, `par`), self-messages

### A4b — Statemachine rendering (✅ done)

Statemachine syntax parses as a graph variant and now renders with dedicated UML
styling across the pipeline (default rounded rectangle state shapes, start/end
state inference for `[*]`, solid compound state frames with header labels, and full
canvas interactivity).

- ✅ Default rounded rectangle state shapes (`shape: 'rectangle'`, `corner: 'rounded'`)
- ✅ Start and end state resolution for `[*]`, inferred from edge direction:
  - Start state: solid filled circle (`circle`, `fill: 'bold'`, `color: 'gray'`) when acting as an edge source
  - End state: double circle (`double-circle`) when acting strictly as an edge target
- ✅ Compound state group rendering in `@kiyora/render` with solid rounded rectangle frame and top-left header label
- ✅ State transitions and transition labels leverage the existing layered DAG layout with full canvas interactivity (drag, resize)
- ✅ Code-review refinements (Issue 04):
  - Standards: extracted start/end keyword arrays to module-level constants in `graph.ts`, deduplicated regex helpers in render test fixtures, and decoupled `groupMarkup` projection from variant inspection via explicit `isSolid` parameter
  - Spec: preserved standard graph node deduplication for `[*]`, kept scanner free of diagram-specific syntax, and removed unrequested wobble group overlay branch
- ⏳ Statemachine advanced features (deferred to follow-up increment): entry/exit actions, internal transitions, history states (`[H]`), concurrent regions (`--`)

### A4c — ERD / class family (✅ done)

Entity-relationship and UML class diagram family (`class`, `erd`, `uml`).

- ✅ Tolerant line-oriented parser with `class`/`erd`/`uml` keywords and unified `ClassDiagram` AST variant
- ✅ Explicit entity declarations (`EntityName { ... }` or `table`/`class` prefixed) with typed fields and methods separated by `---`
- ✅ Visibility modifier support (`+`, `-`, `#`, `~`) and key attribute recognition (`pk`, `fk`)
- ✅ Crow's foot and UML relationship syntax (`||--o{`, `<|--`, `*--`, `o--`, etc.) with dual-ended arrowheads
- ✅ Dynamic entity box layout in `@kiyora/render` measuring header, fields, methods, and right-aligned key indicators
- ✅ Composite SVG projection with clean white body, colored header fill, dividing paths, and hand-drawn wobble overlays scoped to structural lines
- ✅ Code-review refinements (Issue 04):
  - Standards: extracted layout/projection magic numbers into constants, removed descriptive "what" comments, deduplicated field formatting with shared `formatEntityField`, reused `EntityField` types, renamed cryptic variables, and consolidated `compile.ts` condition checks
  - Spec: supported dual-ended crow's foot relations (`fromCard` and `toCard`), fixed visibility modifier parsing for whitespace separators, and avoided duplicate divider paths when entities have methods without fields
- ⏳ ERD / class advanced features (deferred to follow-up increment): type annotation badges, package/namespace grouping, compartment scrolling

### A4d — Mindmap family (⏳)

Hierarchical radial / tree mindmap diagram family.

- ⏳ Parser changes and `MindMapBranch` AST variant
- ⏳ Radial or horizontal tree auto-layout
- ⏳ Branch curves and text node rendering
- 🚫 Wireframe, infographic, gitgraph, gantt, sankey, chart (later)

Per family: parser changes, AST variant, render path, fixtures. The reference
under `reference/koboyo/compiler/dsl/parser.ts` is the model.

### A5 — Parser attribute backbone (⏳)

Fill in the deferred parser/render attributes that are already parsed but not
honored.

- ⏳ Longform / hex color resolution (`tomato`, `#ff6347` → nearest palette hue
  via ~40 lines of HSL math)
- ⏳ `width` / `value` / `score` honored in render (currently `attribute-ignored`
  warning)
- ⏳ `link` (wrap shape in `<a>` for clickable)
- ⏳ `flow` (animated dashes via CSS keyframes)
- ⏳ `icon` rendering — gated on A6 (icon registry) below

### A6 — Sidebar / multi-document (⏳)

Local persistence beyond the single `kiyora:source` localStorage key.

- ⏳ IndexedDB document store: each document has `{ id, slug, source, scene,
viewport, selection, updatedAt }`
- ⏳ Sidebar UI: list documents, new / duplicate / rename / delete
- ⏳ Slug-based URLs (`/d/<slug>`) — prerequisite to all online features
- ⏳ Autosave: each document is its own localStorage/IndexedDB entry, debounced

Architectural note: this is the _last_ thing in Phase 1.x because it sets up
the document-identity model that everything in Phase 2 builds on.

**Phase 1.x done when:** a user can create multiple diagrams, edit each, save
them across sessions, export to PNG / SVG, and come back to a list of them
tomorrow. The canvas has marquee / copy-paste / delete / rotate / resize.
Shapes wobble. Sequence, statemachine, ERD, and mindmap families parse and
render.

## Phase 2 — Local persistence + identity (v1.x → online bridge)

The "share this canvas" moment requires more than a `.kira` file on disk; it
needs documents with identity. Comments and B3 (cloud save) are additive
primitives that don't yet require a backend.

- ⏳ **B1** IndexedDB document store (sized for offline-first; survives quota)
- ⏳ **B2** Slug-based URLs (`/d/<slug>`), document list, new/duplicate/rename/delete
- ⏳ **B3** Cloud save (single-user, no realtime yet) — adds the first
  backend (Bun/Postgres or equivalent), auth (email OTP + Google/GitHub
  OAuth), and `baseRevision` optimistic concurrency
- ⏳ **B4** Comments on the canvas — anchored threads, replies, resolve.
  Per-document and stored locally first; upgraded to server-backed in Phase 3

**Phase 2 done when:** a user can create accounts, save to cloud, and leave
comments. No real-time yet.

## Phase 3 — Sharing & collaboration (online)

- ⏳ **C1** Auth (email OTP + Google/GitHub OAuth)
- ⏳ **C2** Sharing modes — `private | link | public` + light/dark embed
- ⏳ **C3** Realtime presence (SSE event stream, cursor / selection visibility)
- ⏳ **C4** Real-time co-editing (operation transform or CRDT) — _deferred_;
  only attempted after C1–C3 are stable
- ⏳ **C5** Workspaces / folders / seats

**Phase 3 done when:** two users can open the same canvas in two browsers, see
each other's cursors, edit, and comment. Sharing a canvas as a link works.

## Phase 4 — AI (BYOK) + MCP (the last things)

Per the user's directive, AI / MCP / billing are deferred until the product is
in a good state. When this phase begins, the canvas is feature-complete and
tested, and the AI has something interesting to drive.

- ⏳ **D1** BYOK key management — localStorage-only, provider abstraction
  (Anthropic, OpenAI, …)
- ⏳ **D2** Assistant panel — prompt → diagram, live-streamed build,
  tool-calling against the 17-tool schema, self-correction via diagnostics
- ⏳ **D3** MCP server — `/v1-mcp`, JSON-RPC 2.0 over streamable HTTP/SSE, 17
  tools (`whoami`, `get_syntax`, `create_diagram`, `update_diagram`, etc.)
- 🚫 **D4** Billing (Polar) — strictly last

**Phase 4 done when:** a user can paste their Anthropic / OpenAI key, type
"draw me a sequence diagram for OAuth", and watch a working diagram appear on
the canvas with the AI editing it live. External MCP clients (Claude Desktop,
etc.) can drive Kiyora via the same schema.

## Phase 5 — Full diagram surface (post-AI)

- 🚫 Slides with step reveal (frames, builds, present mode)
- 🚫 Icon library + `find_icons_for` (lucide, mood, emoji, tech, aws, gcp,
  azure, drawnicons ~71k)
- 🚫 Mermaid / Excalidraw / tldraw / eraser.io importers
- 🚫 All remaining families (wireframe / infographic / gitgraph / gantt /
  sankey / chart)

## Out of scope (deliberately)

- 🚫 elkjs layout upgrade — pure layered ships in v1 (ADR-0002); revisit if
  layered quality is insufficient
- 🚫 Pixel-perfect `bpmn` swimlane rendering — flag preserved, no lane drawing
- 🚫 `kanban` board layout — directive preserved, no board drawing
- 🚫 `icons: badge | inside` placement — preference preserved, no placement
- 🚫 Pixel-perfect longform/hex color resolution until A5
- 🚫 `.kby` save/load (Koboyo's local format) — Kiyora uses `.kira`
- 🚫 Desktop app (signed / notarized, auto-update)
- 🚫 Encrypted server-side BYOK proxy for teams

## What this roadmap does NOT include

- Implementation tickets. Each phase has a spec under `.issues/<pkg>/spec.md`
  and per-increment tickets under `.issues/<pkg>/issues/NN-<slug>.md`. The
  spec is the source of truth for scope; the tickets track progress.
- API contract. The reference's inferred OpenAPI lives under
  `reference/koboyo/compiler/api/openapi.yaml`; Kiyora's own API will be
  designed in Phase 2 alongside the backend choice.
- Detailed tech choices for new surfaces (Postgres vs D1, OT vs CRDT, etc.).
  Those are decisions made when the corresponding phase is in scope, not
  before.

## Tracking status

For machine-readable status, the per-package spec headers still read the
historical authoring state (the issue tracker is gitignored bookkeeping).
The actual "what's shipped" state is:

| Package                        | Spec header       | Reality                              |
| ------------------------------ | ----------------- | ------------------------------------ |
| `.issues/web/spec.md`          | `done`            | shipped                              |
| `.issues/canvas/spec.md`       | `ready-for-human` | shipped (acceptance review deferred) |
| `.issues/render/spec.md`       | `ready-for-human` | shipped (acceptance review deferred) |
| `.issues/dsl/spec.md`          | `ready-for-agent` | shipped (acceptance review deferred) |
| `.issues/sequence-mvp/spec.md`           | `done`            | shipped                              |
| `.issues/statemachine-rendering/spec.md` | `ready-for-human` | shipped (acceptance review deferred) |
| `.issues/class-diagram-rendering/spec.md`| `ready-for-human` | shipped (acceptance review deferred) |

We treat reality over headers. A spec header moves to `done` once a sweep
confirms the spec/issue labels match the implementation, and is otherwise
bookkeeping.
