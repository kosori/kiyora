/**
 * The single-workspace local Source storage boundary.
 *
 * Kiyora persists the user's current Kiyora Source under a single
 * localStorage key so that a refresh or a later visit restores what was
 * being edited. Canvas-only Scene placement, selection, and the Viewport
 * are intentionally not persisted: Source is the textual interchange
 * format and the only thing this module knows about.
 *
 * The seam is a thin `SourceStorage` object so the editor page can
 * inject a controlled fake during tests and so the real `localStorage`
 * is only touched in the browser. SSR contexts (no `window`) yield a
 * storage that always reports no stored Source and silently drops
 * writes, since no real editor mounts in that environment.
 */

export const SOURCE_STORAGE_KEY = 'kiyora:source';

export type SourceStorage = {
	/**
	 * Return the previously persisted Source, or `null` when nothing has
	 * been stored under the key yet.
	 */
	load: () => string | null;
	/**
	 * Persist the given Source, replacing any previous value.
	 * Returns true if saved, or false if storage is disabled or quota exceeded.
	 */
	save: (source: string) => boolean;
};

export function browserSourceStorage(): SourceStorage {
	if (typeof window === 'undefined' || !window.localStorage) {
		return {
			load: () => null,
			save: () => false,
		};
	}
	const storage = window.localStorage;
	return {
		load: () => {
			try {
				return storage.getItem(SOURCE_STORAGE_KEY);
			} catch {
				return null;
			}
		},
		save: (source) => {
			try {
				storage.setItem(SOURCE_STORAGE_KEY, source);
				return true;
			} catch {
				// Quota exceeded or storage disabled: dropping the write is
				// safer than crashing the editor, but we notify the caller.
				return false;
			}
		},
	};
}
