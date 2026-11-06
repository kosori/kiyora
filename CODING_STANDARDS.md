# Coding Standards

Read during **review**, not implementation. Every rule here is a judgement call:
if a guardrail could decide it, it belongs in a gate instead.

Scope: `apps/web`, `packages/model`, `packages/editor`, `packages/sync`, and the
root `scripts/`. `packages/dsl` and `apps/web/components/ui` are vendored and
have their own section. The invariants in
[`docs/architecture.md`](docs/architecture.md#invariants) bind every change;
the rules below are how a review applies them.

## The gates already decide

A diff that `bun run check`, `bun run check-types`, `bun run check-budgets`, or
`bun run check-icons` rejects never reaches review. Do not report formatting,
unused locals, file length, a drifted icon dataset, or anything else one of
those commands answers.

Deliberate overrides: `type` over `interface`, `any` allowed only in test files,
and `useArrowFunction` as an error. A barrel is legal only at a package entry
(`packages/*/src/index.ts`, `packages/*/src/react/index.ts`). These choices are
the repo's, not findings — a reversion is.

Every `biome-ignore` carries its rule and a one-line reason. A bare suppression
is a finding.

## Boundaries

- Imports run one way: `dsl ← model ← editor ← apps/web`, and `sync ← apps/web`
  with `sync → model` only. A package importing `apps/`, or `sync` importing
  `editor`, is a finding.
- `model` and `sync` are pure: no React, no DOM, no network, no clock, no
  randomness. `editor` is DOM-free too; `editor/react` is its only React.
- A package's DOM need arrives as an injected port — `Measurer`, `BoardStorage`,
  `SyncTransport` — never as an import. A clock or an id arrives the same way
  (`now`, `mintId`), defaulting at the factory so a test can pin it.
- The app composes. Geometry, colour, text position and layout belong to
  `model`; a second implementation in `apps/web` is a finding even when it is
  shorter.
- Consumers import a package's declared entry — `@kiyora/model`,
  `@kiyora/editor/react`, `@kiyora/model/icons` — never a path inside one.
- One schema owns the board (ADR-0002). A board type is `z.infer`red, never
  hand-mirrored, and `as unknown as` across a package boundary is a finding.

## Domain language

Use the glossary's words in code, tests, comments and docs: **board**, **shape**,
**paint**, **gesture**, **authored**, **derived**, **stale**, **pending**,
**fault**, **linked**, **revision**. The synonyms each entry marks _Avoid_ name
the same concept less precisely — `element` for a shape, `document` for a board,
`viewport` for a camera — and are findings. New domain language gets a
[`docs/glossary.md`](docs/glossary.md) entry in the same change.

## Types

- `type` for every alias, union and object shape. An `interface` that reaches
  review must be suppressing the rule for declaration merging or a generic
  `extends`, and its reason must name which.
- Exclusive states are one discriminated union keyed by `kind` or `status`, never
  a bag of optional flags. `SyncState`, `StorageFault` and `Gesture` are the shape
  to match.
- `unknown` at every boundary, narrowed by a guard (`isObject`, a zod parse,
  `instanceof`). A cast belongs at a boundary the types cannot express and says
  why; `as` used to silence a mismatch is a finding.
- `satisfies` pins a literal without widening it. Prefer it to an annotation that
  erases the keys.
- `readonly` marks data that crosses a seam and must not mutate
  (`readonly Guide[]`, `ReadonlyMap`), not every array.
- A type is exported only when another module imports it. Name it for the
  concept: `…Options` for a factory's input, `…Ports` for injected
  collaborators, `…State` for a readable snapshot, `…Result` for an outcome.
  `Props` is the one exception, below.
- A literal union plus `as const` is the vocabulary; `enum` is a finding.

## Functions and modules

- Arrow functions, always. The linter only catches function *expressions*, so a
  `function` declaration is the review's job: it is a finding outside vendored
  code, and a class (the panel error boundary) is the one shape that is not an
  arrow.
- A module owns one concern, named in kebab-case after it. Mutation lives behind
  a factory (`createEditor`, `createLibrary`, `createSyncMachine`) or a
  deliberate singleton (`icon-set`); module scope otherwise holds constants.
  Helpers stay private; the public surface is the smallest set of functions and
  types that name the concern.
- Compose through ports, not through the parent: a command factory takes
  `board`, `change`, `select`, never the whole editor. A module reaching for a
  sibling's state is a finding.
- A directory grows by concern (`paint/`, `persistence/`, `history/`), not by
  layer.
- A package's `index.ts` is its public surface and its only barrel. An export
  added there for one consumer is Speculative Generality; either the consumer
  imports the concept or the concept moves.
- Named exports everywhere. `export default` belongs to the route files Next
  requires one from (`page`, `layout`, `loading`), to tool configs
  (`next.config.js`, `vitest.config.ts`, `drizzle.config.ts`), and to a tool that
  requires one (Playwright's `globalSetup`).
- JSDoc every exported function, type and constant whose contract is not
  obvious, and every private helper whose reason is not. Say the invariant and
  the why; the repo's comments are prose. A comment restating the line below it
  is noise, and no comment says what a component renders.

## Components and hooks

- One exported component per file. A private helper may share the file when it
  is not exported and is used once there (`RemoteBoardRow`).
- `Props` for the file's exported component. A private helper's props take a
  descriptive name (`RowProps`). When a props type leaves the file it is
  `ComponentNameProps`, and it is exported only when another module imports it.
- `children` is never hand-written. Use `PropsWithChildren<Props>` (imported
  from `react`), or bare `PropsWithChildren` when children are the only prop.
- A DOM element's props come from `ComponentProps<'form'>`, never a hand-written
  copy of that element's surface.
- `'use client'` sits on the component file that needs the browser, not on the
  page above it. A page reads the session on the server and passes data down.
- Shared client state is `createContext<T | undefined>(undefined)` with a
  `useXContext()` that throws outside its provider, in a `context.ts(x)` beside
  its consumers.
- A hook that reads engine state subscribes with `useSyncExternalStore` and
  returns only the value it names. It does not copy board state into
  `useState`, poll, or hand out the whole editor.
- Native elements and their labels come first. Every control a pointer can use
  is reachable and runnable from the keyboard; `tabIndex` on a non-interactive
  element carries a reasoned suppression.

## Route files and server handlers

`page.tsx` and `layout.tsx` take the Next-generated helpers, `PageProps<'/route'>`
and `LayoutProps<'/route'>`, and never a hand-written type. They need no import;
`LayoutProps` already carries `children`; `params` and `searchParams` are
promises to await. A route that takes no props declares none. Among route files,
`export default` is theirs: bind `Page` or `Layout` and export it at the bottom.

A route handler exports its method name (`GET`, `POST`, `DELETE`), reads the
session before the database, reads the body once from `unknown`, and maps a
package's typed decision onto a status. Route params come from
`RouteContext<'/api/…'>`, never a hand-written `{ params: Promise<…> }`. A
business rule re-implemented in the handler — a revision check, a payload parse,
a size limit — is a finding; those live in `@kiyora/sync` or `@kiyora/model`.

No request reaches a third party. The app may call its own origin; anything else
is a spec-level risk, and only a test that asks for it opts out of the offline
fixture.

## Failure

A failure the caller branches on is a variant — `{ kind: 'too-large', bytes,
limit }` — not an exception. Throwing is for a rejected input the caller cannot
continue past (`BoardRejection`), a storage or export refusal, or a programming
error.

- Every user-visible failure has a surface: a fault, a status, a dialog, a line
  of copy. A `catch` that neither rethrows nor sets one is a finding.
- An adapter boundary converts a foreign error once (`faultOf`,
  `faultFromException`); below it, nothing knows a `DOMException` or a platform
  `Error`.
- A thrown error is a named class with `name`, a `readonly` field naming the
  cause, and a message that names the thing that failed — `BoardRejection`,
  `StorageError`, `PngExportRefusal`.
- A best-effort retry or cleanup may swallow, but says why in one line and
  leaves the visible state honest.
- A newer schema, a corrupt payload or an over-limit board is refused and named,
  never migrated by guess or truncated. Quarantine and the recovery snapshot are
  the mechanisms; a fallback that hides damage is a finding.

## Tests

- Two seams only. The app is proven in a browser with Playwright; a package is
  proven with Vitest inside its own workspace. No component tests, no jsdom, no
  DOM mocks, and never another package's internals. `apps/web` has no unit
  runner and needs none.
- A package test is `<module>.test.ts` beside its module. `describe` names the
  behaviour; `it` is a sentence asserting an observable outcome — “draws…”,
  “keeps…”, “refuses…” — never “should work”.
- Assert paint and behaviour. An element count, an attribute's presence or a
  markup snapshot proves nothing (invariant 1); a test that stops there is a
  finding.
- Goldens are byte-exact and committed. A changed golden is deliberate and
  explained by the change; editing one to make a failing test pass is a finding.
- Fixtures are deterministic: seeded boards, fixed timestamps, a fake
  `Measurer`, no network. A test that reaches the world has left the seam.
- End-to-end specs live under `apps/web/tests/e2e` as `*.spec.ts`, inherit the
  offline fixture, and opt out per test only. Each proves a capability or gate
  named in `docs/product/`.

## Vendored and generated files

- `packages/dsl/src` is restored from history (ADR-0005). A diff that changes
  parser behaviour is a finding; it is kept as it was, not re-derived.
- `apps/web/components/ui/**` is generated by the shadcn CLI on Base UI. Its
  `function` declarations, bottom `export { … }`, `cn` from the `cn` package,
  `cva` variants and `data-slot` attributes are correct there; review only
  divergence from the upstream component.
- `packages/model/src/icons/dataset.ts` is written by `bun run icons`; a hand
  edit fails `check-icons` and is not a review finding.
- `**/goldens/**` holds committed artifacts compared byte for byte. Never rewrite
  one to make a test pass.
