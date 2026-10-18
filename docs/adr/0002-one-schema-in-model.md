# One schema, in `@kiyora/model`

Every type in the project is inferred from one zod schema for the board. No type is written twice, and no cast bridges two shapes of the same concept across a package boundary.

Both prior attempts at this product were docked for the same defect: hand-mirrored types in two packages, kept in sync by eye, joined by `as unknown as`. That defect is invisible until it breaks, and when it breaks it is at the seam between the thing that draws and the thing that saves — the worst place to find it.

zod is a dependency in the lowest layer, which is the price. It buys the one property that cannot be reviewed by eye: a document that validates is a document every package can consume.

The rule that keeps it true: adding a shape kind means editing the schema, and the compiler then names every place that must handle it.
