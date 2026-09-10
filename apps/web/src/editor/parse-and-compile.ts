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

/** Fast-path: extract the title directly without parsing the full AST. */
export function parseTitle(source: string): string {
	const match = source.match(/^[ \t]*title[ \t]+([^\r\n]+)/m);
	return match?.[1]?.trim() ?? '';
}
