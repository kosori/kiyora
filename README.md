# Kiyora

An offline whiteboard for diagrams, notes and slides. Draw by hand, or type a diagram as code.

No account. No sync. No network. The board lives in this browser, and the only request the editor makes is for its own assets — a property a test enforces rather than a promise.

```sh
bun install
bun run dev          # http://localhost:3000
```

## What it does

Draw with a hand-drawn look: shapes, connectors, text and sticky notes. Style them in the inspector, pan and zoom an infinite canvas, and present the frames as slides. Save the board to a single `.kyr.json` file or let it autosave. Export PNG at 1×/2×/4× with a transparent or solid background, in light or dark, or export SVG.

The diagram-code panel — type a few lines, get laid-out shapes — arrives in [v1.5](./docs/product/v1.5.md). The parser is already here and tested.

## Repo

```
apps/web             the Next.js app: canvas, chrome, panels
packages/dsl         the source grammar: text to AST with diagnostics
packages/model       the board: schema, geometry, projection
packages/editor      the engine: store, gestures, persistence
tooling/typescript   shared tsconfigs
docs/                architecture, glossary, decisions, product scope
```

Dependencies run one way: `dsl ← model ← editor ← apps/web`.

## Gates

CI runs all of these; run them before you call anything done.

```sh
bun run check            # lint and format
bun run check-types      # types across every workspace
bun run test             # unit, Vitest
bun run test:e2e         # end to end, Playwright
bun run check-budgets    # file size budget
```

## Docs

- [Architecture](./docs/architecture.md) — package boundaries, the document model, the render seam, and the invariants every change keeps. **Read this first.**
- [Glossary](./docs/glossary.md) — the words this project uses.
- [Decisions](./docs/adr/) — what is hard to reverse and why.
- [v1](./docs/product/v1.md) — every capability, and the test that proves it.
- [v1.5](./docs/product/v1.5.md) · [v2](./docs/product/v2.md) — what comes next.
- [Provenance](./docs/provenance.md) — where the code and the behaviours came from.

## Licence

MIT. See [LICENSE](./LICENSE) and [THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md).
