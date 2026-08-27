import type { Scene } from '@kiyora/render';

/**
 * Resolve the editor's current selection to the 1-based Kira Source line of
 * the first selected node.
 *
 * Returns `null` when there is no selection, or when the selected id is no
 * longer in the scene (e.g. the Source was edited and the node was dropped).
 */
export function selectionToLine(
	scene: Scene,
	selection: readonly string[]
): number | null {
	const [firstId] = selection;
	if (firstId === undefined) {
		return null;
	}
	const node = scene.nodes.find((n) => n.id === firstId);
	if (!node) {
		return null;
	}
	return node.span.start.line;
}
