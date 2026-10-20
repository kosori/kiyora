import { SCHEMA_VERSION } from './schema';

/**
 * One step that lifts a stored board payload from one schema version to the
 * next. A migration is a pure function of the document: it may only reason
 * about authored state, because everything derived is recomputed on open. It
 * owns the version it writes, so a chain of them is a chain of whole records.
 */
export type Migration = {
  /** The version the payload is at before this step runs. */
  readonly from: number;
  /** The version it is at after; always `from + 1`. */
  readonly to: number;
  /** Lifts `payload` by one version without mutating it. */
  readonly migrate: (payload: unknown) => unknown;
};

/**
 * Version 0 is the board saved before the record carried a version marker. It is
 * the same document without the marker, so the first step only stamps it. The
 * fixture beside this file (`fixtures/v0.json`) is what that old payload looked
 * like, and `fixtures/v1.json` is what this step owes the next reader.
 */
const stampVersion: Migration = {
  from: 0,
  migrate: (payload) => ({
    ...(payload as Record<string, unknown>),
    schemaVersion: 1,
  }),
  to: 1,
};

/**
 * Version 2 adds two things the version 1 document could not carry: an optional
 * Source on a frame and the group kind. Neither needs a value stamped onto an
 * old board — a frame without a Source is a frame nobody generated from code,
 * and a group is a kind no version 1 board could name — so this step only owns
 * the version. Camera, deck, settings and every authored shape pass through
 * untouched.
 */
const widenShapes: Migration = {
  from: 1,
  migrate: (payload) => ({
    ...(payload as Record<string, unknown>),
    schemaVersion: 2,
  }),
  to: 2,
};

/**
 * Every migration, in order, keyed by the version they lift from. Each one has a
 * committed fixture pair, and a test fails if a migration has no fixture or the
 * chain has a gap. The list is empty only when the running version is the first.
 */
export const MIGRATIONS: readonly Migration[] = [stampVersion, widenShapes];

/** What happened when a payload met the migration chain. */
export type MigrationResult =
  | { status: 'current'; from: number; payload: unknown }
  | { status: 'migrated'; from: number; payload: unknown }
  | { status: 'newer'; version: number }
  | { status: 'unreadable' };

/**
 * The schema version a stored payload declares. A payload with no marker is
 * version 0 — the record before versioning — while bytes that are not an object
 * or carry a marker that is not a whole number are unreadable, not zero.
 */
export const versionOf = (payload: unknown): number | null => {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }
  const marker = (payload as Record<string, unknown>).schemaVersion;
  if (marker === undefined) {
    return 0;
  }
  if (typeof marker !== 'number' || !Number.isInteger(marker)) {
    return null;
  }
  return marker;
};

/**
 * Applies the ordered migrations until the payload is at the running version.
 * A payload already current is returned untouched; one from a newer release, or
 * bytes that will not lift, come back as a refusal rather than a guess.
 */
export const migratePayload = (payload: unknown): MigrationResult => {
  const version = versionOf(payload);
  if (version === null) {
    return { status: 'unreadable' };
  }
  if (version === SCHEMA_VERSION) {
    return { from: version, payload, status: 'current' };
  }
  if (version > SCHEMA_VERSION) {
    return { status: 'newer', version };
  }

  let current = payload;
  let at = version;
  while (at < SCHEMA_VERSION) {
    const step = MIGRATIONS.find((migration) => migration.from === at);
    if (step === undefined) {
      return { status: 'unreadable' };
    }
    try {
      current = step.migrate(current);
    } catch {
      return { status: 'unreadable' };
    }
    if (versionOf(current) !== step.to) {
      return { status: 'unreadable' };
    }
    at = step.to;
  }

  return { from: version, payload: current, status: 'migrated' };
};
