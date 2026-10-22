import { z } from 'zod';
import { shapeBaseSchema } from './shape-base';

/**
 * A table: a grid of typed cells inside the shape's authored box. The columns
 * and the row count are authored, and so is the header flag because it changes
 * what the first row looks like; every cell size is derived by dividing the box
 * evenly, so resizing a table scales the whole grid and no stored width can go
 * stale. Cells are row-major strings — the text a person typed, never a span
 * model — and an empty row list is a valid, degenerate table rather than a
 * broken file.
 */
export const tableSchema = shapeBaseSchema.extend({
  columns: z.number().int().nonnegative(),
  headerRow: z.boolean(),
  kind: z.literal('data-table'),
  rows: z.array(z.array(z.string())),
});

/** A table: rows and columns of typed cells, drawn in its authored box. */
export type TableShape = z.infer<typeof tableSchema>;
