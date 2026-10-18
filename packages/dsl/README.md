# `@kiyora/dsl`

The source grammar: diagram code to a typed AST, with diagnostics instead of failures.

```ts
parse(source: string): ParseResult   // { diagram, diagnostics }
```

## What it owns

- The scanner, and a parser per family: graph, sequence, class/ERD, mindmap.
- `Diagram`, `Node`, `Edge`, `Group`, `Actor`, `Entity`, `Message`, `MindMapBranch`, `Span`, `Diagnostic`.
- The vocabulary: `SHAPES`, `COLORS`, `FILLS`, `CORNERS`, `FRAMES`, `HEADS`, `ARROWS`, `FAMILIES`, their aliases, and palette hue snapping.

The vocabulary is **load-bearing for the shape tool**, not only for parsing. `@kiyora/model` imports it, so the picker and the parser can never disagree about what a rectangle is.

## Boundaries

- **Leaf.** No runtime dependencies, no DOM, no imports from outside the package.
- The AST is never routed through the board schema. A parser's model is not a document's model; the bridge maps between them, in one place, when the code panel arrives.
- A malformed line produces a diagnostic. The parse always continues.

## This package is vendored

Copied from this repository's git history and kept as it was, for the reasons in [ADR-0005](../../docs/adr/0005-dsl-copied-not-re-derived.md). It is exempt from the file size budget, and its test suite is ported with it.

The golden fixtures in `test/fixtures/` — one `.kira` input and one `.json` expectation per case — are the parser's **specification**. They are not a snapshot to be refreshed; a diff there is a behaviour change.

## Tests

```sh
bun run test --filter=@kiyora/dsl
```
