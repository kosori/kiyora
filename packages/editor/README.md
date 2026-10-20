# `@kiyora/editor`

The engine: the store, the gestures, the history, the hit-testing, the persistence.

## What it owns

| Area | Responsibility |
| --- | --- |
| store | Board state, selection, active tool, and the subscription other code reads |
| `history/` | Gestures, transactions, coalescing, the bounded undo stack |
| geometry | Hit-testing, snapping, handles, bounds, world and screen coordinates |
| commands | Add, move, resize, rotate, delete, duplicate, copy, cut, paste, reorder |
| `persistence/` | The repository chain, autosave, migrations, quarantine, faults |
| keymap | Every binding, as the one source the `?` dialog is generated from |
| `react/` | A thin adapter: a canvas host, a context, a subscription hook |

## Boundaries

- **DOM-free.** Every gesture, undo, snap and migration is testable in a plain process, with no browser.
- React appears only under `react/`, which is a host element, a context and a `useSyncExternalStore` hook. Nothing else in the package knows React exists.
- It consumes `@kiyora/model`; it never imports from `apps/`.

## The rules it enforces

- One gesture, exactly one history entry. A drag commits on pointer-up; nudges coalesce; Escape restores the before-picture and pushes nothing.
- Undo never restores the camera or the selection. Panning is never undoable and never autosaves.
- Commit **notifies** subscribers. The toolbar reads its enabled state from that notification, never by polling — a stale undo button was a real defect in an earlier implementation.
- Storage faults are typed and surfaced, never swallowed.

See [docs/architecture.md](../../docs/architecture.md#editing).

## Tests

```sh
bun run test --filter=@kiyora/editor
```

Written fresh rather than ported: the earlier implementation's suite encoded a different document model, so porting it would have ported the wrong contract.
