import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ICON_VIEWBOX } from '../packages/model/src/icons/icon-set';
import { messageOf, rootFrom, runsAsScript, UsageError } from './cli';
import { ICON_NAMES } from './icon-names';

/**
 * Builds the committed icon dataset from the curated list in `icon-names.ts`.
 *
 * `@tabler/icons-react` is the dependency the app already has, and its own
 * `@tabler/icons` package ships the SVG each component is generated from. The
 * generator reads those files rather than rendering React: the path data is the
 * source, and nothing here needs a component tree.
 *
 * Every outline icon is authored in the same `ICON_VIEWBOX` square. A source
 * icon in another box is refused rather than guessed at, because the walker's
 * one scale assumes the shared space; add a normaliser here if the library ever
 * moves.
 *
 * `bun run icons` writes the dataset. `bun run check-icons` regenerates it in
 * memory and fails when the committed bytes differ, so a hand edit cannot pass
 * a gate. The test beside this file proves that failure.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Where the generated dataset is committed. */
export const DATASET_PATH = 'packages/model/src/icons/dataset.ts';

const usage = 'usage: bun scripts/icons.ts [--check] [--root <directory>]';

const requireFromWeb = createRequire(join(root, 'apps/web/package.json'));

let outline: string | null = null;

/** The directory the Tabler outline SVGs live in, resolved once per run. */
const outlineDirectory = (): string => {
  if (outline !== null) {
    return outline;
  }

  const react = dirname(
    requireFromWeb.resolve('@tabler/icons-react/package.json')
  );
  const directory = join(react, '..', 'icons', 'icons', 'outline');

  if (!existsSync(directory)) {
    throw new Error(`the Tabler icons are not installed at ${directory}`);
  }

  outline = directory;
  return outline;
};

/** The attributes one SVG element declares, keyed by name, from either quote style. */
const attributesOf = (source: string): Map<string, string> => {
  const attributes = new Map<string, string>();

  for (const match of source.matchAll(
    /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g
  )) {
    const [, name, doubleQuoted, singleQuoted] = match;
    if (name !== undefined) {
      attributes.set(name, doubleQuoted ?? singleQuoted ?? '');
    }
  }

  return attributes;
};

/** The `viewBox` an SVG declares, or `null` when it carries none. */
const viewBoxOf = (svg: string): string | null => {
  const opening = /<svg\b([^>]*)>/.exec(svg)?.[1];
  return opening === undefined
    ? null
    : (attributesOf(opening).get('viewBox')?.trim() ?? null);
};

/**
 * One SVG's path data, in the order it draws them, without the transparent
 * backdrop. A visible path the dataset cannot express, or one without `d`, is
 * refused with the icon named rather than silently dropped.
 */
export const pathsOf = (name: string, svg: string): string[] =>
  [...svg.matchAll(/<path\b([^>]*)>/g)].flatMap((match) => {
    const attributes = attributesOf(match[1] ?? '');
    if (
      attributes.get('stroke') === 'none' &&
      attributes.get('fill') === 'none'
    ) {
      return [];
    }

    const d = attributes.get('d');
    if (d === undefined) {
      throw new Error(`the icon ${name} has a <path> without a d attribute`);
    }

    for (const style of ['fill', 'stroke', 'stroke-width']) {
      const value = attributes.get(style);
      if (value !== undefined && value !== 'none') {
        throw new Error(
          `the icon ${name} carries ${style}="${value}", a path style the dataset cannot express`
        );
      }
    }

    return [d];
  });

/** One icon's path data, read from its Tabler SVG and checked against the shared box. */
export const readIcon = (name: string): string[] => {
  const file = join(outlineDirectory(), `${name}.svg`);
  if (!existsSync(file)) {
    throw new Error(`the icon ${name} is not in the Tabler outline set`);
  }
  const svg = readFileSync(file, 'utf8');
  const viewBox = viewBoxOf(svg);
  if (viewBox !== `0 0 ${ICON_VIEWBOX} ${ICON_VIEWBOX}`) {
    throw new Error(
      `the icon ${name} is authored in ${viewBox ?? 'no viewBox'}, not the shared ${ICON_VIEWBOX}-unit box`
    );
  }
  const paths = pathsOf(name, svg);
  if (paths.length === 0) {
    throw new Error(`the icon ${name} draws no path`);
  }

  return paths;
};

/** The dataset module for `names`, in the format the generator commits. */
export const renderDataset = (
  names: readonly string[] = ICON_NAMES
): string => {
  const seen = new Set<string>();
  const entries = names.map((name) => {
    if (seen.has(name)) {
      throw new Error(`the icon ${name} appears twice in the list`);
    }
    seen.add(name);
    const paths = readIcon(name).join(' ');

    return `  ${JSON.stringify(name)}: ${JSON.stringify(paths)},\n`;
  });

  return `// Generated by \`bun run icons\`; edit \`scripts/icon-names.ts\` instead.
import type { IconSet } from './icon-set';

export { ICON_VIEWBOX } from './icon-set';

/** Every icon the board ships, keyed by the name a shape stores. */
export const ICONS = {
${entries.join('')}} as const satisfies IconSet;
`;
};

/** The errno code a filesystem error carries, when it carries one. */
const codeOf = (error: unknown): string | undefined => {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return undefined;
  }

  return typeof error.code === 'string' ? error.code : undefined;
};

/** Whether `path` holds exactly the dataset `renderDataset` would write, or why it does not. */
export const checkDataset = (
  path: string,
  names: readonly string[] = ICON_NAMES
): string | null => {
  const expected = renderDataset(names);
  let actual: string;

  try {
    actual = readFileSync(path, 'utf8');
  } catch (error) {
    if (codeOf(error) !== 'ENOENT') {
      throw error;
    }
    return `${path} is missing; run \`bun run icons\``;
  }

  return actual === expected ? null : `${path} is stale; run \`bun run icons\``;
};

/** Writes to stderr with the `icons:` prefix and marks the gate failed. */
const fail = (error: unknown): void => {
  if (error instanceof UsageError) {
    process.stderr.write(`icons: ${error.message}\n\n${usage}\n`);
  } else {
    process.stderr.write(`icons: ${messageOf(error)}\n`);
  }
  process.exitCode = 1;
};

if (runsAsScript(import.meta.url)) {
  const argv = process.argv.slice(2);

  try {
    const target = join(rootFrom(argv, root), DATASET_PATH);

    if (argv.includes('--check')) {
      const problem = checkDataset(target);
      if (problem === null) {
        process.stdout.write(
          `icons: ${ICON_NAMES.length} icons in the committed dataset\n`
        );
      } else {
        process.stderr.write(`icons: ${problem}\n`);
        process.exitCode = 1;
      }
    } else {
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, renderDataset());
      process.stdout.write(
        `icons: wrote ${ICON_NAMES.length} icons to ${relative(process.cwd(), target) || DATASET_PATH}\n`
      );
    }
  } catch (error) {
    fail(error);
  }
}
