import type { Tool } from '../tools';
import { useView } from './use-view';

/**
 * The active tool, re-rendering the caller whenever the tool changes. The tool
 * lives in the view, so this reads the same subscription the camera does.
 */
export const useTool = (): Tool => useView().tool;
