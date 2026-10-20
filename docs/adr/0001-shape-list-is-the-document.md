# The shape list is the document of record

The board is the truth, and diagram code is an input that stamps shapes onto it. Applying source replaces a frame's shapes as one gesture; editing the shapes afterwards leaves the source untouched and marks it stale. Nothing writes a hand edit back into the source.

The alternative — source text is the document, and the canvas is a view of it — is a legitimate product, and it is the one an earlier attempt at this product chose. It was rejected because it makes every drag either forbidden or lossy: the user moves a shape, and the move has nowhere to live. Here, everything drawn survives.

Two consequences are load-bearing. There is no `shapes → source` serializer in v1 or v1.5, because there is nothing to write back to. And the code panel's staleness is information, not an error: regenerating is always explicit, and always one undo.
