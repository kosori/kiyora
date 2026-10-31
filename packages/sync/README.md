# `@kiyora/sync`

The reconciler: the protocol both copies agree on, and the state machine that runs it.

## What it owns

| Area | Responsibility |
| --- | --- |
| `protocol.ts` | Size, payload validity and the revision check as one decision both copies share |
| `reconcile.ts` | The state machine: local, pending, syncing, synced, conflict, too large, signed out, error |
| `transport.ts` | The `SyncTransport` port the app maps onto its routes |

## Boundaries

- **DOM-free.** The state machine is tested against a fake transport in a plain process.
- It depends on `@kiyora/model` for the board type and the byte count, and never on `editor` or the DOM.
- No request, no storage and no clock lives here: the surface that owns a board supplies the bytes and persists what the machine learned.

## The rules it enforces

- Linking is explicit and uploads at `baseRevision: null`; nothing else creates a remote copy.
- A write is accepted only at the stored revision. A mismatch is a conflict that carries the remote copy, never a merge.
- A retry whose hash equals the stored one is idempotent: it answers with the current revision and does not bump it.
- One upload runs at a time; a save that lands mid-flight queues the latest bytes.
- A board over the 4 MiB sync limit is refused before anything is sent.

See [docs/architecture.md](../../docs/architecture.md#sync) and [ADR-0011](../../docs/adr/0011-sync-is-a-revision-check-not-a-merge.md).

## Tests

```sh
bun run test --filter=@kiyora/sync
```
