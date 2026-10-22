# Layout is ours, and it is deterministic

The parser produces ids, labels, edges, groups and source spans. It produces no coordinates, by design and by provenance. So the bridge from source to shapes has to place them, and `@kiyora/model` grows a small layered layout: rank nodes along the diagram's `direction`, place them on ranks, derive group boxes, and let the existing connector routing join them.

The obvious move is a layout library. Dagre, elk, or whatever the ecosystem is on by the time someone reads this. It is rejected for one reason that outranks quality: a golden test can only exist if the same source always produces the same board. A library's output is a function of its version, and its version moves. Every golden becomes a migration chore, and the tripwire that catches a bridge regression stops being a tripwire.

Position-in-source is rejected for a different reason. It looks like the cheap answer — let the author say where things go — but it means editing the grammar, and ADR-0005 makes the grammar copied, never re-derived. There is no version of this where we own the language.

That leaves determining the layout from the document, and the alternative to a dependency is a hundred lines of ranking and placement we can read, test and freeze.

## Consequences

- Layout lives in `model`, pure and DOM-free, beside the geometry it feeds.
- A golden test per family is the layout's specification, exactly as the fixtures are the parser's.
- The quality ceiling is a layered layout, not a hand-tuned diagram. Editing the shapes after applying is the escape hatch, and it is the same escape hatch the hand-drawn decision (ADR-0007) relies on.
- No dependency is added and the payload budget does not move.
- If the layout is ever the complaint, the fix is a better algorithm inside the same seam, not a library swap.

See [ADR-0005](./0005-dsl-copied-not-re-derived.md) for why the grammar is fixed, and [ADR-0007](./0007-clean-geometry-hand-drawn-type.md) for the escape hatch.
