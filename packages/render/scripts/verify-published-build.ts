import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDirectory = dirname(dirname(fileURLToPath(import.meta.url)));
const workspaceRoot = join(packageDirectory, '..', '..');
const temporaryDirectory = mkdtempSync(
	join(tmpdir(), 'kiyora-render-consumer-')
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
		throw new Error(
			`${commandAndArguments.join(' ')} failed in ${cwd}${stderr ? `:\n${stderr}` : ''}`
		);
	}
	return stdout;
}

function stagePackage(sourceDirectory: string, packageName: string): string {
	const stageDirectory = join(temporaryDirectory, packageName);
	mkdirSync(stageDirectory, { recursive: true });
	cpSync(
		join(sourceDirectory, 'package.json'),
		join(stageDirectory, 'package.json')
	);
	cpSync(join(sourceDirectory, 'README.md'), join(stageDirectory, 'README.md'));
	cpSync(join(sourceDirectory, 'dist'), join(stageDirectory, 'dist'), {
		recursive: true,
	});
	const output = run(
		[
			command('npm'),
			'pack',
			'--ignore-scripts',
			'--pack-destination',
			packageDirectoryForTarballs,
		],
		stageDirectory
	);
	return join(packageDirectoryForTarballs, output.split('\n').at(-1) ?? '');
}

try {
	mkdirSync(packageDirectoryForTarballs, { recursive: true });
	run([command('bun'), 'run', 'build'], join(workspaceRoot, 'packages', 'dsl'));
	run([command('bun'), 'run', 'build'], packageDirectory);
	const dslTarball = stagePackage(
		join(workspaceRoot, 'packages', 'dsl'),
		'dsl'
	);
	const renderTarball = stagePackage(packageDirectory, 'render');

	writeFileSync(
		join(temporaryDirectory, 'package.json'),
		JSON.stringify(
			{
				devDependencies: { typescript: '7.0.2' },
				name: 'kiyora-render-consumer',
				private: true,
				type: 'module',
			},
			null,
			2
		)
	);
	writeFileSync(
		join(temporaryDirectory, 'index.ts'),
		`import { compile, render, renderToSvg, type Scene } from '@kiyora/render';
import { parse } from '@kiyora/dsl';

const scene: Scene = compile(parse('flowchart\\nA -> B').diagram);
const output = renderToSvg(scene);
render(parse('flowchart').diagram);
output.width satisfies number;
`
	);
	writeFileSync(
		join(temporaryDirectory, 'tsconfig.json'),
		JSON.stringify(
			{
				compilerOptions: {
					lib: ['ES2022'],
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

	run(
		[
			command('npm'),
			'install',
			'--ignore-scripts',
			'--no-audit',
			'--no-fund',
			dslTarball,
		],
		temporaryDirectory
	);
	run(
		[
			command('npm'),
			'install',
			'--ignore-scripts',
			'--no-audit',
			'--no-fund',
			renderTarball,
		],
		temporaryDirectory
	);
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
