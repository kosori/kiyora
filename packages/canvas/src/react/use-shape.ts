import type { SceneNode } from '@kiyora/render';
import { useSyncExternalStore } from 'react';
import { useEditor } from './use-editor';

const EMPTY_SNAPSHOT: SceneNode | undefined = undefined;

/** Subscribe to one scene node without re-rendering for unrelated scene edits. */
export function useShape(id: string): SceneNode | undefined {
	const editor = useEditor();
	return useSyncExternalStore(
		editor.subscribe,
		() => {
			const node = editor
				.getSnapshot()
				.scene.nodes.find((candidate) => candidate.id === id);
			return node ?? EMPTY_SNAPSHOT;
		},
		() => {
			const node = editor
				.getSnapshot()
				.scene.nodes.find((candidate) => candidate.id === id);
			return node ?? EMPTY_SNAPSHOT;
		}
	);
}
