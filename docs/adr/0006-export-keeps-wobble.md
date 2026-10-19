# Export keeps the hand-drawn wobble

**Superseded by [ADR-0007](0007-clean-geometry-hand-drawn-type.md).**

PNG and SVG exports include the hand-drawn overlay by default. The wobble is a pure, seeded function of each shape, so exports stay deterministic and reproducible.

The obvious rule is the opposite one, and it is tempting: keep clean geometry as the export contract and treat the wobble as a display-only overlay. That rule is defensible for a chart renderer, where the export should be the data. It is wrong here, because the hand-drawn look *is* the product: an export with clean rectangles is a different drawing than the one on screen, and the user would be right to call it a bug.

The invariant it must not break is the one about display state — an artifact must not contain selection, hover, camera or drag state. Wobble is none of those. It is authored geometry, rendered twice.

## Consequences

- `clean: true` is a later, opt-in flag for true geometry, not the default.
- Text measuring and wobble both run in the projection path, which is why both are pure.
