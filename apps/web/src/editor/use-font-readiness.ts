import { useEffect, useState } from 'react';
import type { ExportFonts, FontReadiness } from './io/io';

export type FontReadinessState = {
	/** The embedded font bytes once the readiness promise has resolved. */
	fonts: ExportFonts | null;
	/** True when the readiness promise has settled — successfully or not. */
	ready: boolean;
	/** Concise error when the promise rejected; null otherwise. */
	failure: string | null;
};

/**
 * Subscribe to a `FontReadiness` and report whether the required faces
 * are loaded.
 *
 * The hook starts in the "preparing" state (`ready: false`,
 * `fonts: null`, `failure: null`) while the promise is pending. A
 * successful resolution populates `fonts` and flips `ready` to `true`.
 * A rejection also flips `ready` to `true` so the editor can re-enable
 * the export actions; the rejection message becomes `failure` so an
 * attempted export surfaces it as a file-operation error in the
 * editor's footer instead of leaving the user stuck with a disabled
 * action and no explanation.
 */
export function useFontReadiness(readiness: FontReadiness): FontReadinessState {
	const [state, setState] = useState<FontReadinessState>({
		failure: null,
		fonts: null,
		ready: false,
	});
	useEffect(() => {
		let cancelled = false;
		setState({ failure: null, fonts: null, ready: false });
		readiness.ready.then(
			(fonts) => {
				if (!cancelled) {
					setState({ failure: null, fonts, ready: true });
				}
			},
			(cause: unknown) => {
				if (cancelled) {
					return;
				}
				const message =
					cause instanceof Error
						? cause.message
						: 'Font resources could not be prepared for export.';
				setState({ failure: message, fonts: null, ready: true });
			}
		);
		return () => {
			cancelled = true;
		};
	}, [readiness]);
	return state;
}
