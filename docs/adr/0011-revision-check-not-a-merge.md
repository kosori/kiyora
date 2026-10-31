# Sync is a revision check, not a merge

The local copy is the only editable one. A sync names the revision its local copy was built on; the server accepts the write only when that is still the current revision, and a mismatch is a **conflict** a person resolves by keeping theirs, taking the remote copy, or duplicating their own. Nothing merges, and nothing is last-write-wins.

The alternatives were considered and rejected. Last-write-wins silently discards one person's afternoon, which is the exact failure sync exists to prevent. A field-level three-way merge has no defensible answer for two different positions of the same shape, or a deletion against an edit, without knowing intent. A CRDT (Yjs or similar) would make every shape kind carry conflict semantics — ink points, table cells, chart series, the deck — and would pre-invest in the real-time collaboration row that v2 explicitly allows to slip forever.

## Consequences

- Two people editing the same board in two browsers get a conflict, not a merged board. The conflict is stored with the local copy and survives a reload.
- Real-time collaboration needs its own decision later. It cannot be retrofitted quietly onto this model, and it may never ship.
- The local copy stays authoritative for editing, so the offline promise is a property of the design rather than a mode.
