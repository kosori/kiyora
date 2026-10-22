/**
 * The square every icon path is authored in. The generator normalises each
 * Tabler icon to this box, and the walker scales that box into the shape a
 * person drew, so one dataset serves every icon size.
 */
export const ICON_VIEWBOX = 24;

/**
 * The icon paths a name resolves to, in the shared coordinate space. The
 * dataset is generated, and a board carries only the name, so the paint walker
 * is handed the set rather than importing it: the library stays out of the
 * first paint and the artifact still sees everything it needs.
 */
export type IconSet = Readonly<Record<string, string>>;
