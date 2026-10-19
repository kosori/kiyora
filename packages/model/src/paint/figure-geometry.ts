import type { FigureKind } from '../board/schema';
import { BASIC_GEOMETRY } from './figure-geometry-basic';
import { DIAGRAM_GEOMETRY } from './figure-geometry-diagram';
import type { FigureGeometry } from './shape-path';

/**
 * One geometry per figure kind, the whole grammar vocabulary in one table. The
 * `satisfies` is the compile-time contract: a kind added to the schema with no
 * geometry named here stops the build, exactly as the palette does.
 */
export const FIGURE_GEOMETRY = {
  ...BASIC_GEOMETRY,
  ...DIAGRAM_GEOMETRY,
} satisfies Record<FigureKind, FigureGeometry>;
