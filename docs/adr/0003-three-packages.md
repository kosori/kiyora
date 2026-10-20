# Three packages: `dsl`, `model`, `editor`

`dsl` parses source text. `model` owns the board — schema, geometry, the paint walker, the SVG projection. `editor` owns editing — store, gestures, history, hit-testing, persistence — with a thin React adapter. Dependencies run one way: `dsl ← model ← editor ← apps/web`.

The split is drawn at testability, not at size. `model` is DOM-free and React-free, so the export path is provably blind to display state: the projector receives a board and nothing else. `editor` is DOM-free with a 50-line React adapter, so every gesture, every undo and every snap is testable without a browser. The app holds chrome and nothing that could be a library.

Two alternatives were rejected. One package: the seam between authoring and painting would have to be enforced by convention, which is not enforcement. A separate `render` package: the paint walker is one function producing one structure, and splitting its input (the model) from its output (the backends) would put the two halves of a single decision in different folders.

## Consequences

- Anything needing a DOM — measuring text, rasterizing PNG — is injected or lives in the app. See [the measurer](../architecture.md#the-measurer).
- `apps/web` must not compute geometry, colour or text position, even when it would be shorter.
