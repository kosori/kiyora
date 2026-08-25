# @kiyora/render

DOM-free compilation and static SVG projection for Kiyora graph diagrams.

## API

```ts
import {
	compile,
	render,
	renderToSvg,
	type Scene,
} from '@kiyora/render';

const scene: Scene = compile(diagram);
const result = renderToSvg(scene, { padding: 24 });
const oneCall = render(diagram);
// result and oneCall are { svg, width, height }
```

- `compile(diagram)` creates a deterministic `Scene` with positioned nodes,
  id-referencing edges, source spans, semantic style tokens, and diagram
  metadata.
- `renderToSvg(scene, options?)` projects a scene to `{ svg, width, height }`.
  Options are `width`, `height`, `fontFamily`, `nodeFontSize`, `edgeFontSize`,
  and `padding`.
- `render(diagram, options?)` combines compilation and SVG projection.

### Scene contract

`Scene` is the canonical, framework-agnostic output of the renderer. It is
JSON-serializable: `nodes`, `edges`, and `groups` are plain arrays, and every
shape carries its source `span`. Its public shape is:

```ts
type Scene = {
  nodes: SceneNode[]; edges: SceneEdge[]; groups: SceneGroup[];
  title: string; direction?: 'right' | 'down' | 'left' | 'up';
  legend?: { label: string; swatch: string }[];
};

type SceneNode = {
  id: string; label: string; x: number; y: number;
  width: number; height: number; span: Span;
  shape?: string; color?: Color; fill?: Fill; corner?: Corner;
  shadow?: boolean; labelColor?: Color; icon?: string; link?: string;
  group?: string;
};
type SceneEdge = {
  from: string; to: string; span: Span; label?: string;
  dashed?: boolean; bidirectional?: boolean; color?: Color;
  flow?: boolean; head?: Head; invisible?: boolean; back?: boolean;
};
type SceneGroup = {
  id: string; label: string; span: Span; color?: Color;
  frame?: Frame; icon?: string; parent?: string;
};
```

Nodes contain their position and size plus semantic style tokens; edges refer to
node IDs rather than storing coordinates; group bounds and edge geometry are
derived by a projection. Selection is canvas-owned transient state and is not
part of a `Scene`.

The public root entry point also exports the pure `layout`, `style`, `shapes`,
`geometry`, and label measurement helpers for another renderer such as the
canvas. Package internals remain unexported.

Icons, links, animated flow, swimlanes, and other deferred features are carried
or preserved by the DSL but are not rendered in v1. See the [deferred
ledger](../../docs/v1-scope.md#deferred--rendercanvas) for revisit triggers.

## Development

From the repository root:

```sh
bun run --cwd packages/render typecheck
bun run --cwd packages/render test
bun run --cwd packages/render build
```
