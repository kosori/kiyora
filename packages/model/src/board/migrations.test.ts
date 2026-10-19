import { readFileSync } from 'node:fs';
import {
  MIGRATIONS,
  migratePayload,
  parseBoard,
  SCHEMA_VERSION,
  versionOf,
} from '@kiyora/model';
import { describe, expect, it } from 'vitest';

/** The committed fixture for one schema version, read as the bytes a save left. */
const fixture = (version: number): unknown =>
  JSON.parse(
    readFileSync(
      new URL(`./fixtures/v${version}.json`, import.meta.url),
      'utf8'
    )
  ) as unknown;

/** A payload with no version marker: the shape of a save from before versioning. */
const unversioned = {
  camera: { x: 0, y: 0, zoom: 1 },
  createdAt: 1_700_000_000_000,
  deck: [],
  id: 'board-1',
  settings: { theme: 'light' },
  shapes: [],
  title: 'Untitled',
  updatedAt: 1_700_000_000_000,
};

describe('reading a payload version', () => {
  it('reads the version the payload declares', () => {
    expect(versionOf({ schemaVersion: 3 })).toBe(3);
  });

  it('treats a missing marker as the version before versioning', () => {
    expect(versionOf(unversioned)).toBe(0);
  });

  it('reports nothing for a payload that is not an object', () => {
    expect(versionOf('truncated')).toBeNull();
    expect(versionOf(null)).toBeNull();
  });

  it('reports nothing for a marker that is not a whole number', () => {
    expect(versionOf({ schemaVersion: 'one' })).toBeNull();
    expect(versionOf({ schemaVersion: 1.5 })).toBeNull();
  });
});

describe('the migration chain', () => {
  it('is ordered, contiguous and reaches the current version without gaps', () => {
    MIGRATIONS.forEach((migration, index) => {
      expect(migration.from).toBe(index);
      expect(migration.to).toBe(migration.from + 1);
    });
    const last = MIGRATIONS.at(-1);
    expect(last?.to ?? 0).toBe(SCHEMA_VERSION);
  });

  it('carries a fixture for every migration, and each lifts it to the next', () => {
    for (const migration of MIGRATIONS) {
      const input = fixture(migration.from);
      const expected = fixture(migration.to);

      expect(migration.migrate(input)).toEqual(expected);
    }
  });

  it('leaves the last fixture a board this code can read', () => {
    expect(() => parseBoard(fixture(SCHEMA_VERSION))).not.toThrow();
  });
});

describe('migrating a payload', () => {
  it('lifts an unversioned payload to the current version, keeping its content', () => {
    const result = migratePayload(unversioned);

    expect(result.status).toBe('migrated');
    if (result.status !== 'migrated') {
      throw new Error('expected a migration');
    }
    expect(result.from).toBe(0);
    expect(parseBoard(result.payload).schemaVersion).toBe(SCHEMA_VERSION);
    expect(parseBoard(result.payload).title).toBe('Untitled');
  });

  it('leaves a payload already at the current version untouched', () => {
    const current = { schemaVersion: SCHEMA_VERSION };
    const result = migratePayload(current);

    expect(result).toEqual({
      from: SCHEMA_VERSION,
      payload: current,
      status: 'current',
    });
  });

  it('refuses a payload from a version this code does not know', () => {
    expect(migratePayload({ schemaVersion: SCHEMA_VERSION + 1 })).toEqual({
      status: 'newer',
      version: SCHEMA_VERSION + 1,
    });
  });

  it('reports unreadable bytes rather than guessing', () => {
    expect(migratePayload('truncated')).toEqual({ status: 'unreadable' });
    expect(migratePayload({ schemaVersion: 'soon' })).toEqual({
      status: 'unreadable',
    });
  });
});
