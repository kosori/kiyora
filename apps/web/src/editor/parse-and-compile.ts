import { parse } from '@kiyora/dsl';
import { compile, type Scene } from '@kiyora/render';

export type ParseAndCompileResult = {
	diagnostics: ReturnType<typeof parse>['diagnostics'];
	scene: Scene;
};

const EMPTY_SCENE: Scene = {
	edges: [],
	groups: [],
	nodes: [],
	title: '',
};

/** Parse Source and compile its best-effort Diagram into a renderable Scene. */
export function parseAndCompile(source: string): ParseAndCompileResult {
	if (source.trim().length === 0) {
		return { diagnostics: [], scene: EMPTY_SCENE };
	}

	const result = parse(source);
	return {
		diagnostics: result.diagnostics,
		scene: compile(result.diagram),
	};
}

/** Parse Source and return its Diagram title without compiling a Scene. */
export function parseTitle(source: string): string {
	if (source.trim().length === 0) {
		return '';
	}
	return parse(source).diagram.title;
}
