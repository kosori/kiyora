import { spawnSync } from 'node:child_process';
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDirectory = dirname(dirname(fileURLToPath(import.meta.url)));
const workspaceRoot = join(packageDirectory, '..', '..');
const temporaryDirectory = mkdtempSync(
	join(tmpdir(), 'kiyora-canvas-consumer-')
);
const packageDirectoryForTarballs = join(temporaryDirectory, 'packages');
const command = (name: string): string =>
	process.platform === 'win32' ? `${name}.cmd` : name;

function run(commandAndArguments: string[], cwd: string): string {
	const result = spawnSync(
		commandAndArguments[0] ?? '',
		commandAndArguments.slice(1),
		{
			cwd,
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'pipe'],
		}
	);
	const stderr = result.stderr.trim();
	const stdout = result.stdout.trim();
	if (result.status !== 0) {
		const output = [stderr, stdout].filter(Boolean).join('\n');
		throw new Error(
			`${commandAndArguments.join(' ')} failed in ${cwd}${output ? `:\n${output}` : ''}`
		);
	}
	return stdout;
}

function packPackage(sourceDirectory: string): string {
	const output = run(
		[
			command('bun'),
			'pm',
			'pack',
			'--ignore-scripts',
			'--destination',
			packageDirectoryForTarballs,
			'--quiet',
		],
		sourceDirectory
	);
	const filename = output.split('\n').at(-1)?.trim();
	if (!filename) {
		throw new Error(
			`bun pm pack returned no package filename for ${sourceDirectory}`
		);
	}
	const tarball = join(packageDirectoryForTarballs, basename(filename));
	const listing = run([command('tar'), '-tzf', tarball], sourceDirectory);
	const unexpectedFiles = listing
		.split('\n')
		.map((path) => path.replace(/^package\//u, ''))
		.filter(
			(path) =>
				path !== 'package.json' &&
				path !== 'README.md' &&
				!path.startsWith('dist/')
		);
	if (unexpectedFiles.length > 0) {
		throw new Error(
			`Published package contains unexpected files: ${unexpectedFiles.join(', ')}`
		);
	}
	return tarball;
}

try {
	mkdirSync(packageDirectoryForTarballs, { recursive: true });
	run([command('bun'), 'run', 'build'], join(workspaceRoot, 'packages', 'dsl'));
	run(
		[command('bun'), 'run', 'build'],
		join(workspaceRoot, 'packages', 'render')
	);
	run([command('bun'), 'run', 'build'], packageDirectory);

	const coreEntry = readFileSync(
		join(packageDirectory, 'dist', 'index.js'),
		'utf8'
	);
	if (/\breact\b/iu.test(coreEntry)) {
		throw new Error(
			'The core canvas entry must not contain React runtime code.'
		);
	}

	const dslTarball = packPackage(join(workspaceRoot, 'packages', 'dsl'));
	const renderTarball = packPackage(join(workspaceRoot, 'packages', 'render'));
	const canvasTarball = packPackage(packageDirectory);

	writeFileSync(
		join(temporaryDirectory, 'package.json'),
		JSON.stringify(
			{
				devDependencies: {
					'@types/react': '19.2.18',
					'@types/react-dom': '19.2.4',
					react: '19.2.8',
					'react-dom': '19.2.8',
					typescript: '7.0.2',
				},
				name: 'kiyora-canvas-consumer',
				private: true,
				type: 'module',
			},
			null,
			2
		)
	);
	writeFileSync(
		join(temporaryDirectory, 'index.ts'),
		`import { createEditor, createEngine, renderScene, type Scene } from '@kiyora/canvas';
import { Canvas, useEditor, useShape } from '@kiyora/canvas/react';
import { createElement } from 'react';

const scene: Scene = { edges: [], groups: [], nodes: [], title: '' };
const editor = createEditor(scene);
const svg = renderScene(editor.getSnapshot());
const engine = createEngine(document.createElement('div'), editor);
engine.destroy();

function Consumer() {
	const currentEditor = useEditor();
	const node = useShape('missing');
	return createElement(Canvas, { editor: currentEditor }, node?.label ?? svg);
}

void Consumer;
`
	);
	writeFileSync(
		join(temporaryDirectory, 'tsconfig.json'),
		JSON.stringify(
			{
				compilerOptions: {
					lib: ['ES2022', 'DOM', 'DOM.Iterable'],
					module: 'preserve',
					moduleResolution: 'bundler',
					noEmit: true,
					strict: true,
					target: 'ES2022',
				},
				include: ['index.ts'],
			},
			null,
			2
		)
	);

	for (const tarball of [dslTarball, renderTarball, canvasTarball]) {
		run(
			[
				command('npm'),
				'install',
				'--ignore-scripts',
				'--no-audit',
				'--no-fund',
				tarball,
			],
			temporaryDirectory
		);
	}
	run(
		[
			join(temporaryDirectory, 'node_modules', '.bin', command('tsc')),
			'--noEmit',
		],
		temporaryDirectory
	);
	console.log('Published package consumer verification passed.');
} finally {
	rmSync(temporaryDirectory, { force: true, recursive: true });
}
