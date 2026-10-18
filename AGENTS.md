<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": true` in the root `turbo.json` or `turbo.jsonc` to opt in; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->

# Kiyora

An offline whiteboard. Draw by hand, or type a diagram as code.

## Before you change anything

- **[docs/architecture.md](docs/architecture.md)** — package boundaries, the document model, the render seam, and the **invariants**. Read it before your first edit; re-read the invariants before you claim a task done.
- **[docs/glossary.md](docs/glossary.md)** — the project's words: board, shape, paint, gesture, stale, frame, deck. Use them in code, tests, commits and docs.
- **[docs/adr/](docs/adr/)** — the decisions that are hard to reverse. If your change contradicts one, say so out loud rather than quietly overriding it.
- **[docs/product/v1.md](docs/product/v1.md)** — what v1 promises, and the test that proves each capability. A capability whose test asserts an element count is not proven.

## Gates

Run all four before you call work done. The first two also gate a commit's worth of confidence; the last two are slow and can be run once per task.

```sh
bun run check            # lint and format
bun run check-types      # types across every workspace
bun run test             # unit, Vitest
bun run test:e2e         # end to end, Playwright
bun run check-budgets    # file size budget
```

The end-to-end run uses port `4319` and never reuses a running server, so it can only test this app.

## Package boundaries

- A package never imports from `apps/`.
- `model` is React-free and DOM-free. `editor` is DOM-free, with its React adapter under `editor/react`.
- Anything needing a DOM — measuring text, rasterizing — is injected, never imported into `model`.
- `apps/web` composes; it does not compute geometry, colour or text position.
- Packages export TypeScript source. There is no package build step, so there is no `dist` to rebuild.

## Agent skills

### Issue tracker

Issues live in GitHub Issues for `kosori/kiyora`, driven by the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context. The glossary is `docs/glossary.md`, not a root `GLOSSARY.md`. See `docs/agents/domain.md`.
