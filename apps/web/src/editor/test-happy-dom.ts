import { afterEach } from 'bun:test';
import { Window } from 'happy-dom';

const cleanups: Array<() => void> = [];

afterEach(() => {
	for (const fn of cleanups.splice(0)) {
		fn();
	}
});

const GLOBAL_KEYS = [
	'DOMRect',
	'document',
	'window',
	'HTMLElement',
	'HTMLButtonElement',
	'HTMLTextAreaElement',
	'HTMLDivElement',
	'Element',
	'Node',
	'Event',
	'KeyboardEvent',
	'ResizeObserver',
	'InputEvent',
] as const;

type GlobalKey = (typeof GLOBAL_KEYS)[number];

/**
 * Install a happy-dom Window as the active globals for the current test.
 *
 * The `@base-ui/react` Button and React itself reach for browser globals like
 * `HTMLElement` and `document` directly. happy-dom exposes them on the Window
 * instance, so we copy a fixed set of constructors over to `globalThis` for the
 * duration of one test. The original values are restored in `afterEach`.
 */
export function withHappyDom(): { d: Document; w: Window } {
	const w = new Window();
	const d = w.document as unknown as Document;
	const globals = globalThis as unknown as Record<string, unknown>;
	const wAny = w as unknown as Record<string, unknown>;
	const previous: Partial<Record<GlobalKey, unknown>> = {};
	for (const key of GLOBAL_KEYS) {
		previous[key] = globals[key];
		globals[key] = wAny[key];
	}
	cleanups.push(() => {
		for (const key of GLOBAL_KEYS) {
			const value = previous[key];
			if (value === undefined) {
				delete globals[key];
			} else {
				globals[key] = value;
			}
		}
	});
	return { d, w: w as unknown as Window };
}
