# The board's theme and the browser's appearance are different things

A board already has a theme. It is authored, it travels in the board file, and it decides the colour of every exported artifact. Dark mode tempts you to collapse that into one switch: the app goes dark, the board follows, done.

It is not done. Collapsing them means the day someone flips a UI toggle, every exported PNG changes background, the document is written to, autosave fires, and a preference about *this browser* has silently become a property of *this document*. It also means a board opened by two people looks different to each of them, which is a bug report waiting for v2's sharing.

So there are two settings with two words. **Theme** is the board's: authored, stored, exported. **Appearance** is the chrome's: a preference of this browser, never in a document, never touching an export.

The cost is a dark app showing a light board, and that is not a cost. It is what a document editor does, and it is correct: the document looks how its author made it.

## Consequences

- `Appearance` never reaches `model`. Nothing in the render seam can read it.
- Export keeps its own theme argument, independent of both, as it already had.
- No board setting records appearance, so a shared board renders identically for everyone in v2.
- `docs/glossary.md` carries both words and each one's avoid-list, because this is exactly the confusion the glossary exists for.
