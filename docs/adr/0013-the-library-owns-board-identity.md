# The library owns a board's id

A board's id is generated in the browser with `crypto.randomUUID()` before any server sees it. The server uses that id as the primary key and never assigns one. The id never changes: not on sync, not on share, not when a board moves between browsers.

The alternative is a server-assigned id, which reads as tidier until the offline promise is applied. A board must be creatable with the network off, so it needs an id immediately; a server-assigned id would mean a provisional local id and rewriting every shape reference, history entry and library record the first time the board reached the server — or uploading a board before the person could work in it. Neither is worth the tidiness.

## Consequences

- Duplicating a board, or importing a file whose id the library already holds, mints a new id. Two boards never share one.
- Authorization never depends on the id being unguessable. Ownership is checked on every request, and a share link carries a separate token.
- A board id can appear in a URL (`/b/<id>`) without granting anything.
