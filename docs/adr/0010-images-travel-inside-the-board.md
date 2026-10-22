# An image's bytes travel inside the board file

An image lives in the board file itself. The file carries a `files` map keyed by id, and a shape that shows an image references one by `fileId`. Import downscales the picture once, each image has a byte cap, and the existing 8 MiB board-file cap stays the outer bound on all of them together.

The alternative is a blob store beside the board, with the board holding a key into it. It reads as the tidier split until the glossary's definition is applied: a Board file is one `.kyr.json` that reopens byte-identical. A board pointing at bytes elsewhere no longer satisfies that, and copying the file no longer copies the picture. A side store also adds a second lifetime to manage: delete a shape and its blob remains, so import, undo, delete and save each need orphan collection. The board file already has one lifetime and one serializer.

Downscaling happens on import so the cap measures what the board carries, not the resolution of whatever camera produced the file. The per-image cap stops one picture from consuming the whole board, and the board-file cap remains the outer bound because that is the number the open path already enforces before it reads the file into a string.

## Consequences

- Autosave re-serialises the payload on every save. The bytes are immutable and the serializer is deterministic, so a cache is only worth adding if a measurement says the copy hurts.
- The localStorage fallback cannot hold a board with images. It must refuse that board with a typed Fault, surfaced like the other storage faults, rather than write a board whose images are missing.
