import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { messageOf, runsAsScript, UsageError } from './cli';

/**
 * Cuts the web subsets of the vendored faces from their upstream TTFs.
 *
 * Both upstreams (`nilbuild/balsamiq-sans-neue` for the hand-drawn face and
 * `vercel/geist-font` for the monospace one) publish TTFs only, so a weight
 * becomes a web asset in one command: add it to `WEIGHTS`, run
 * `mise exec -- bun run fonts:subset`. The bytes land in
 * `apps/web/public/fonts`, beside the OFL text the licence requires.
 *
 * Requires `pyftsubset` (fonttools): `python3 -m pip install fonttools brotli`.
 * The TTFs are cached under `.cache/fonts` and downloaded once; `--offline`
 * refuses the network and reads only the cache.
 */

/** The web subset: the Google Fonts latin range, which is every glyph a board needs. */
const LATIN =
  'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';

/** Where the hand-drawn face's TTFs live. */
const BALSAMIQ =
  'https://github.com/nilbuild/balsamiq-sans-neue/raw/main/fonts';

/** Where the monospace face's TTFs live. */
const GEIST_MONO =
  'https://github.com/vercel/geist-font/raw/main/fonts/GeistMono/ttf';

/**
 * Every weight the app ships: its source TTF upstream, and the woff2 it
 * becomes. `Model` names both families, and the page and the raster resolve
 * them from these same bytes.
 */
export const WEIGHTS = [
  {
    output: 'balsamiq-sans-neue-regular.woff2',
    source: 'BalsamiqSansNeue-Regular.ttf',
    upstream: BALSAMIQ,
  },
  {
    output: 'balsamiq-sans-neue-bold.woff2',
    source: 'BalsamiqSansNeue-Bold.ttf',
    upstream: BALSAMIQ,
  },
  {
    output: 'geist-mono-regular.woff2',
    source: 'GeistMono-Regular.ttf',
    upstream: GEIST_MONO,
  },
  {
    output: 'geist-mono-bold.woff2',
    source: 'GeistMono-Bold.ttf',
    upstream: GEIST_MONO,
  },
] as const;

/** One entry of `WEIGHTS`. */
export type Weight = (typeof WEIGHTS)[number];

/** The weights one run should cut, and whether it may reach the network. */
export type FontRun = {
  offline: boolean;
  weights: readonly Weight[];
};

/** How long a TTF download may take before it is aborted. */
export const DOWNLOAD_TIMEOUT_MS = 30_000;

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cache = join(root, '.cache', 'fonts');
const fonts = join(root, 'apps', 'web', 'public', 'fonts');

const usage = `usage: bun scripts/subset-font.ts [weight ...] [--offline]

  weight     one or more of: ${WEIGHTS.map((weight) => weight.output.replace('.woff2', '')).join(', ')}
  --offline  do not download a missing TTF; read only the cache`;

/**
 * The weights one run should cut, parsed from `argv`. An unknown flag is a
 * `UsageError` so `--offlin` cannot fall through to an online run, and a weight
 * is matched by its exact name so `mono` cannot select both Geist faces.
 */
export const parseRun = (argv: readonly string[]): FontRun => {
  const flags = argv.filter((arg) => arg.startsWith('-'));
  const unknownFlags = flags.filter((flag) => flag !== '--offline');
  if (unknownFlags.length > 0) {
    throw new UsageError(`unknown flag(s): ${unknownFlags.join(', ')}`);
  }

  const byName = new Map<string, Weight>(
    WEIGHTS.map((weight) => [weight.output.replace(/\.woff2$/, ''), weight])
  );
  const chosen: Weight[] = [];
  const unknownNames: string[] = [];

  for (const name of argv.filter((arg) => !arg.startsWith('-'))) {
    const weight = byName.get(name);
    if (weight === undefined) {
      unknownNames.push(name);
    } else {
      chosen.push(weight);
    }
  }

  if (unknownNames.length > 0) {
    throw new UsageError(
      `unknown weight(s): ${unknownNames.join(', ')}\nvalid weights: ${[...byName.keys()].join(', ')}`
    );
  }

  return {
    offline: flags.includes('--offline'),
    weights: chosen.length === 0 ? [...WEIGHTS] : chosen,
  };
};

/** The cached TTF for one weight, or `null` when only an unfinished download is present. */
export const cachedSource = (
  cacheDirectory: string,
  source: string
): string | null => {
  const path = join(cacheDirectory, source);
  return existsSync(path) ? path : null;
};

/**
 * Downloads `url` to `cached` through `<cached>.partial` and an atomic rename,
 * so an interrupted download can never be mistaken for a cached TTF. A failed
 * or timed-out download removes its partial and throws a normal `Error`.
 */
export const downloadSource = async (
  cached: string,
  url: string,
  request: typeof fetch = fetch
): Promise<void> => {
  const partial = `${cached}.partial`;

  try {
    const response = await request(url, {
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(
        `downloading ${url} failed: ${response.status} ${response.statusText}`
      );
    }
    mkdirSync(dirname(cached), { recursive: true });
    writeFileSync(partial, Buffer.from(await response.arrayBuffer()));
    renameSync(partial, cached);
  } catch (error) {
    rmSync(partial, { force: true });
    if (error instanceof Error && error.name === 'TimeoutError') {
      throw new Error(
        `downloading ${url} timed out after ${DOWNLOAD_TIMEOUT_MS} ms`,
        { cause: error }
      );
    }
    throw error;
  }
};

/** The TTF for one weight, downloaded to the cache once. */
const sourceFor = async (
  source: string,
  upstream: string,
  offline: boolean
): Promise<string> => {
  const cached = cachedSource(cache, source);
  if (cached !== null) {
    return cached;
  }
  if (offline) {
    throw new Error(`${source} is not cached and --offline was given`);
  }

  const path = join(cache, source);
  await downloadSource(path, `${upstream}/${source}`);
  return path;
};

/** Cuts one weight to `apps/web/public/fonts`, or throws with what went wrong. */
const cut = (source: string, output: string): void => {
  const result = spawnSync(
    'pyftsubset',
    [
      source,
      `--unicodes=${LATIN}`,
      '--layout-features=*',
      '--flavor=woff2',
      `--output-file=${join(fonts, output)}`,
    ],
    { encoding: 'utf8' }
  );

  if (result.error) {
    throw new Error(
      `running pyftsubset failed: ${result.error.message}. Install fonttools and brotli: python3 -m pip install fonttools brotli`
    );
  }
  if (result.status !== 0) {
    throw new Error(`pyftsubset ${source} failed:\n${result.stderr}`);
  }

  process.stdout.write(`cut ${output}\n`);
};

const main = async (): Promise<void> => {
  const run = parseRun(process.argv.slice(2));
  mkdirSync(fonts, { recursive: true });
  const sources = await Promise.all(
    run.weights.map((weight) =>
      sourceFor(weight.source, weight.upstream, run.offline)
    )
  );

  run.weights.forEach((weight, index) => {
    const source = sources[index];
    if (source !== undefined) {
      cut(source, weight.output);
    }
  });
};

if (runsAsScript(import.meta.url)) {
  try {
    await main();
  } catch (error) {
    process.stderr.write(`${messageOf(error)}\n`);
    if (error instanceof UsageError) {
      process.stderr.write(`${usage}\n`);
    }
    process.exitCode = 1;
  }
}
