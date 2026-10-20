# Third-party notices

Kiyora is MIT-licensed. It depends on the following, and ships the following bytes.

Where the origin is this repository's own history, see [docs/provenance.md](./docs/provenance.md).

## Vendored source

| Component | Licence | Notes |
| --- | --- | --- |
| `@kiyora/dsl` (`packages/dsl`) | MIT | Authored for this project under the same copyright; restored from this repository's own git history, where commits and blame are intact |

## Typeface

| Component | Licence | Notes |
| --- | --- | --- |
| Balsamiq Sans Neue | SIL Open Font License 1.1 | A re-fitted derivative of Balsamiq Sans, renamed by its author; not endorsed by the original authors. The licence text ships beside the font bytes |
| Geist Mono | SIL Open Font License 1.1 | Copyright 2024 The Geist Project Authors. The licence text ships beside the font bytes |

## Runtime dependencies

| Component | Licence | Used by |
| --- | --- | --- |
| `zod` | MIT | `@kiyora/model` — the board schema |
| `react`, `react-dom` | MIT | `@kiyora/editor`, `apps/web` |
| `next` | MIT | `apps/web` |
| `tailwindcss` | MIT | `apps/web` |
| `@base-ui/react` | MIT | `apps/web` — UI primitives behind the components |
| `class-variance-authority`, `clsx`, `tailwind-merge` | MIT | `apps/web` — class composition |

Every remaining dependency is permissively licensed and ships its own licence text next to its package in the dependency tree.
