# `@kiyora/web`

The app: the canvas, the chrome around it, and the tests that prove the product.

```sh
bun run dev --filter=@kiyora/web
```

Runs at `http://localhost:3000`. A normal Next.js server, deliberately **not** a static export — auth, an assistant proxy and MCP all need server routes later. See [ADR-0004](../../docs/adr/0004-offline-by-construction.md).

## What it owns

| Area | Responsibility |
| --- | --- |
| `app/` | Routes, layout, theme tokens, the vendored font faces via `public/fonts` |
| canvas host | Mounts the React adapter, wires gestures, keyboard and the camera |
| tool rail, inspector | Selection and style surfaces |
| menus, panels | Board file, export, slides, the shortcut dialog, the status bar |
| export | The PNG raster path, which needs a canvas and therefore lives here |
| `public/fonts`, `scripts/subset-font.ts` | The vendored woff2 subsets and the licence text beside them |
| `lib/` | Glue with no home in a package |

## Boundaries

- **Composes, does not compute.** No geometry, no colour maths, no text position. Those come from `@kiyora/model`.
- Everything needing a DOM lives here — measuring, rasterizing, clipboard, file pickers — behind an interface `model` or `editor` accepts.
- **No request leaves this app** except for its own assets. A test enforces it.
- Vendored `components/ui/**` is shadcn on Base UI, and is exempt from the file size budget, like `packages/dsl/src`.

## Tests

```sh
bun run test:e2e                      # Playwright, from the repo root
```

This app has **no unit test runner**. Everything it owns is proven in a browser, at the seam where the user is: geometry and colour come from `@kiyora/model`, so there is nothing here worth testing in isolation, and a jsdom test of the glue would assert an implementation detail rather than a behaviour.

End to end runs on port **4319** with `reuseExistingServer: false`, and a global setup asserts the served page carries this app's build marker — so a stray server on another port is a loud failure rather than a silent pass.

The e2e suite is where a capability is proven, per the table in [docs/product/v1.md](../../docs/product/v1.md). Assertions are on paint and behaviour: a test that counts elements proves nothing.
