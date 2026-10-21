# `@kiyora/model`

The board. One schema, one paint walker, and the pure projection to SVG.

## What it owns

| Area | Responsibility |
| --- | --- |
| `board/` | The zod schema, the shape union, validation, migrations, serialization |
| `paint/` | Figure geometry, the palette and style resolution |
| `projection/` | `Paint` to an SVG string |
| `text/` | Inline markdown runs, wrapping, and the measurement protocol |
| `layout/` | The deterministic layered layout a Source's direction produces |
| `file/` | The `.kyr.json` board file |

## Public API

```ts
parseBoard(input: unknown): Board                    // validates, then migrates
serializeBoard(board: Board): string                 // byte-stable
paintBoard(board: Board, ctx: PaintContext): Paint
paintShape(shape: Shape, ctx: PaintContext): Paint
toSvg(board: Board, ctx: PaintContext): string
measureTextWith(measure: Measurer): PaintContext
layoutGraph(diagram, frame, options?): Layout         // pure, no dependency
```

Plus the vocabulary re-exported from `@kiyora/dsl`, so the app has one import for shape kinds, colours and frames.

## Boundaries

- **Pure.** No React, no DOM, no request. It runs in a test process with no browser.
- Everything it cannot do alone is **injected**: the theme, and the measurer. That is why `toSvg` is deterministic and why the export can never contain display state — [`toSvg` receives a board and nothing else](../../docs/adr/0003-three-packages.md).
- Adding a shape kind means editing the schema. The compiler then names every place that must handle it.

## Invariants it guards

Assert paint and behaviour, not element counts (1). One schema, no hand-mirrored types (2). No borrowed measurements (3). Export sees only a board (6). Only authored state is stored (9).

See [docs/architecture.md](../../docs/architecture.md#invariants).

## Tests

```sh
bun run test --filter=@kiyora/model
```

`projection/goldens/*.svg` are committed files, not snapshots. Every golden is paired with paint assertions on the shapes it contains, because a golden alone is how an invisible text tool ships.
