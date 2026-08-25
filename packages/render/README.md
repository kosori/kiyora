# @kiyora/render

DOM-free compilation and static SVG projection for Kiyora graph diagrams.

## API

- `compile(diagram)` creates a deterministic `Scene` with positioned nodes,
  id-referencing edges, source spans, semantic style tokens, and diagram
  metadata.
- `renderToSvg(scene, options?)` projects a scene to `{ svg, width, height }`.
- `render(diagram, options?)` combines compilation and SVG projection.

The public `Scene` contains plain arrays and keeps edge geometry and group bounds
as derived projection concerns. Import `layout`, `style`, `shapes`, `geometry`,
and label measurement helpers when building another renderer.

Icons, links, animated flow, swimlanes, and other deferred features are carried
or preserved by the DSL but are not rendered in v1. See [`docs/v1-scope.md`](../../docs/v1-scope.md).

## Development

From the repository root:

```sh
bun run --cwd packages/render typecheck
bun run --cwd packages/render test
bun run --cwd packages/render build
```
