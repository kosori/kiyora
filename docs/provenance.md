# Provenance

What in this repository came from somewhere else, and what it owes.

## `packages/dsl`

Restored from this repository's own git history, where it was authored under the same copyright and the same MIT licence. Its commit history and blame are intact, so attribution is carried by the repository itself rather than by a notice. See [ADR-0005](adr/0005-dsl-copied-not-re-derived.md).

## Behaviours

Several behaviours were specified against an earlier private reimplementation of the same product. No source code was copied; the shapes of these were studied, and the defects found in them became the first regression tests and the invariants:

- The transaction and coalescing model: one gesture, one history entry, a `coalescingKey`, a before-picture, a bounded history, camera outside it.
- The storage fault taxonomy: `quota`, `blocked`, `corrupt`, `unavailable`, and quarantine instead of overwrite.
- The export sanitisation posture: an attribute allowlist, a paint validator, raster-only image sources, and a final assertion that the artifact contains no active content.
- The offline end-to-end guard as an allowlist rather than a denylist.
- The icon dataset pattern — a committed, generated dataset with a generator and a `--check` test — noted for the v1.5 icon library, not built yet.

Two of that implementation's user-visible defects are recorded here so they are never reproduced:

- **Invisible text.** A text shape painted `fill: none` because its paint fell back to the shape's stroke, and every test asserted content or font size rather than fill. This is why [invariant 1](architecture.md#invariants) exists and why the text capability's test asserts paint.
- **A stale undo button.** A gesture committed a history entry without notifying subscribers, so the toolbar's button stayed disabled until an unrelated notification arrived. This is why history commit must notify, and why the keymap and toolbar read from a subscription.

## Typeface

`Balsamiq Sans Neue`, SIL Open Font License 1.1, vendored from its upstream repository. The licence text ships beside the bytes. It is a re-fitted derivative of Balsamiq Sans, renamed by its author, and it is not endorsed by the original authors.

## Nothing else

No third-party source code was copied into this repository. Every runtime dependency is listed with its licence in [THIRD-PARTY-NOTICES.md](../THIRD-PARTY-NOTICES.md).
