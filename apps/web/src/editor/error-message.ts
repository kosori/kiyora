/**
 * Extract a user-visible message from an unknown thrown value.
 *
 * The web I/O boundary and the editor page both have to translate
 * `Promise.reject(new Error(...))` and bare-throw rejections into a
 * single string the file-status footer can render. Without a helper the
 * `cause instanceof Error ? cause.message : fallback` check is open-coded
 * in four call sites, and it is easy for one of them to drift away from
 * the others.
 */
export function errorMessageOf(cause: unknown, fallback: string): string {
	return cause instanceof Error ? cause.message : fallback;
}
