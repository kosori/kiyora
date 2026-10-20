import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cache = join(root, '.cache', 'fonts');
const fonts = join(root, 'apps', 'web', 'public', 'fonts');

const usage = `usage: bun scripts/subset-font.ts [weight ...] [--offline]

  weight     one or more of: ${WEIGHTS.map((weight) => weight.output.replace('.woff2', '')).join(', ')}
  --offline  do not download a missing TTF; read only the cache`;

/** The TTF for one weight, downloaded to the cache once. */
const sourceFor = async (
  source: string,
  upstream: string,
  offline: boolean
): Promise<string> => {
  const cached = join(cache, source);
  if (existsSync(cached)) {
    return cached;
  }
  if (offline) {
    throw new Error(`${source} is not cached and --offline was given`);
  }

  const response = await fetch(`${upstream}/${source}`);
  if (!response.ok) {
    throw new Error(
      `downloading ${source} failed: ${response.status} ${response.statusText}`
    );
  }
  mkdirSync(cache, { recursive: true });
  writeFileSync(cached, Buffer.from(await response.arrayBuffer()));
  return cached;
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
  const args = process.argv.slice(2);
  const offline = args.includes('--offline');
  const requested = args.filter((arg) => !arg.startsWith('--'));

  const chosen =
    requested.length === 0
      ? [...WEIGHTS]
      : WEIGHTS.filter((weight) =>
          requested.some((name) => weight.output.includes(name))
        );

  if (chosen.length === 0) {
    process.stderr.write(`${usage}\n`);
    process.exitCode = 1;
    return;
  }

  mkdirSync(fonts, { recursive: true });
  const sources = await Promise.all(
    chosen.map((weight) => sourceFor(weight.source, weight.upstream, offline))
  );
  chosen.forEach((weight, index) => {
    const source = sources[index];
    if (source !== undefined) {
      cut(source, weight.output);
    }
  });
};

const runsAsScript = (): boolean => {
  const [, entry] = process.argv;
  return (
    entry !== undefined && resolve(entry) === fileURLToPath(import.meta.url)
  );
};

if (runsAsScript()) {
  await main();
}
