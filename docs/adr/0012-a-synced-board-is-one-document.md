# A synced board is one document, so sync has a limit

A board travels as one serialized document, the same bytes a `.kyr.json` holds (ADR-0010). Vercel caps a function's request body and response body at 4.5 MB, so the sync limit is 4 MiB: below the board file's 8 MiB, and enforced on the serialized payload before anything is sent. A board above it stays local, keeps working, and says it is too large to sync.

The obvious alternative is object storage for a board's rasters: upload the bytes direct to a blob store, keep only `fileId`s in the payload, and let the CDN serve the images. That bypasses the function cap, but it breaks the rule that a board is one document when it holds files, and it adds a second lifetime to manage — delete a shape and its blob remains, so import, undo, delete and share each need orphan collection. The sync limit is a smaller promise than a half-owned document.

## Consequences

- An image-heavy board can be saved locally and cannot be synced or shared. That is visible and typed, not silent.
- The board file's 8 MiB cap and the sync limit are different numbers, on purpose, and the status bar names which one bit.
- If generated images make a blob store the right answer, that is a new decision with its own ADR. It is not a quiet relaxation of this one.
