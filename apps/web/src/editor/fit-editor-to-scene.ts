import type { Editor } from '@kiyora/canvas/react';
import { contentBounds, deriveGroupBoxes } from '@kiyora/render';

export type FitContainerSize = { height: number; width: number };

/**
 * Fit the editor's viewport to its current scene's content bounds.
 *
 * The editor's `fitToBounds` already no-ops when the content is fully visible,
 * so this helper is safe to call from both the canvas-host's one-shot mount
 * effect and the toolbar's "zoom to fit" button.
 */
export function fitEditorToScene(editor: Editor, size: FitContainerSize): void {
	const groupBoxes = deriveGroupBoxes(editor.getScene());
	const bounds = contentBounds(editor.getScene(), groupBoxes);
	editor.fitToBounds(bounds, size);
}
