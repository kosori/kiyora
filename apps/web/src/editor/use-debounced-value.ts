import { useEffect, useState } from 'react';

/**
 * Track a value, lagging it behind by `delayMs`.
 *
 * The returned value updates only after `delayMs` of inactivity — useful for
 * "compile on idle" semantics where every keystroke should not trigger an
 * expensive downstream computation. The hook re-runs the timer whenever the
 * input value changes, so the latest value always wins once the debounce
 * settles.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
	const [debounced, setDebounced] = useState(value);

	useEffect(() => {
		const handle = setTimeout(() => setDebounced(value), delayMs);
		return () => clearTimeout(handle);
	}, [value, delayMs]);

	return debounced;
}
