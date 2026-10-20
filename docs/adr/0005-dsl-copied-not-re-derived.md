# `@kiyora/dsl` is copied, never re-derived

`packages/dsl` is restored from this repository's own history, where it was MIT-licensed and complete: a tolerant parser with source spans, diagnostics, eight diagram families, and a golden fixture for every fixture source file. It is kept as it was, and its vocabulary is load-bearing for the shape tool even before the code panel exists.

The parser is the hardest asset in the project and the only one a rebuild would be likely to get wrong. The failure mode is specific and worth naming: six weeks in, the new architecture wants slightly different types, so the parser gets "done properly" — and the result has fewer tests, none of the golden fixtures, and no advantage. Treat re-deriving it as a rejection, not a refactor.

Its test suite is ported with it. The golden fixtures are the parser's specification, so they are kept as a specification, not converted into unit-test assertions.

## Consequences

- `packages/dsl/src` is exempt from the file size budget, like other vendored code.
- The parser's AST is never routed through the board's schema. A parser's model is not a document's model; the bridge, when it arrives in v1.5, maps between them in one tested place.
