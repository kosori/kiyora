# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`docs/glossary.md`** — this repo is single-context, and the glossary lives under `docs/` rather than at the repo root.
- **`docs/adr/`**: read the ADRs that touch the area you're about to work in.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or decisions actually get resolved.

## File structure

This repo is single-context. Everything domain-facing lives under `docs/`:

```
/
├── docs/
│   ├── glossary.md                    ← the vocabulary
│   ├── architecture.md                ← boundaries, the model, the invariants
│   ├── adr/
│   │   ├── 0001-shape-list-is-the-document.md
│   │   └── …
│   ├── product/
│   │   ├── v1.md
│   │   ├── v1.5.md
│   │   └── v2.md
│   ├── provenance.md
│   └── agents/                        ← the docs in this folder
├── apps/web/
└── packages/{dsl,model,editor}/
```

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `docs/glossary.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal: either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (clean geometry, hand-drawn type), but worth reopening because…_
