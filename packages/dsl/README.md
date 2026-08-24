# @kiyora/dsl

`@kiyora/dsl` parses Kira (`.kira`) diagram source into a typed graph `Diagram`.
It has no runtime dependencies and supports the graph-family variants
`architecture`, `flowchart`, `bpmn`, `orgchart`, and `statemachine`.

## API

```ts
import { parse, type Diagram, type Diagnostic, type ParseResult } from '@kiyora/dsl';

const result: ParseResult = parse(`flowchart
A -> B: request`);
const diagram: Diagram = result.diagram;
const diagnostics: Diagnostic[] = result.diagnostics;
```

The package also exports the AST types (`Node`, `Edge`, `Group`, `Span`, and
related types) and vocabulary constants and resolvers such as `SHAPES`,
`COLORS`, `resolveShape`, `resolveColor`, `slugify`, and `uniqueId`.

## Tolerant parsing

`parse(source)` never throws and always returns a best-effort `Diagram`. An
`error` diagnostic means that the malformed statement was dropped; a `warning`
means that the statement parsed with a caveat. Diagnostics contain a machine-
readable kebab-case `code` and a 1-based source `span`.

Empty or whitespace-only source produces an empty graph with no diagnostics.
Unclosed groups and malformed attribute blocks are reported while recoverable
content is retained. v1 recognizes `width`, `value`, and `score`, but reports
them as `attribute-ignored` warnings rather than adding unsupported AST fields.

The current diagnostic codes are `attribute-ignored`, `expected-colon`,
`expected-node-name`, `self-edge`, `unclosed-block`, `unknown-attribute`,
`unknown-color`, `unknown-shape`, `unmatched-block`, and `unsupported-family`.

## Grammar reference

See the [Kira grammar reference](https://github.com/kosori/kiyora/blob/main/reference/koboyo/compiler/dsl/grammar.md)
for the language syntax and vocabulary. The
[`showcase.kira`](https://github.com/kosori/kiyora/blob/main/packages/dsl/test/fixtures/showcase.kira)
fixture is a compact, readable example of the supported graph dialect; its
JSON companion is the expected parsed result.

## Development

```sh
bun test packages/dsl
bun --cwd packages/dsl run build
bun --cwd packages/dsl run typecheck
```

The publishable package contains only `dist/`, with JavaScript and TypeScript
declarations resolved through the package exports.
