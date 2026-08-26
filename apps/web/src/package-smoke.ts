import { createEditor } from '@kiyora/canvas';
import { Canvas, useEditor } from '@kiyora/canvas/react';
import { parse } from '@kiyora/dsl';
import { compile } from '@kiyora/render';

/** Exercise the package boundaries used by the web app. */
export function createPackageSmoke(source: string) {
	const { diagram } = parse(source);
	const editor = createEditor(compile(diagram));

	return {
		Canvas,
		editor,
		useEditor,
	};
}
