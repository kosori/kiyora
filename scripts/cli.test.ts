import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { messageOf, rootFrom, runsAsScript, UsageError } from './cli';

const fallback = '/a/fallback';

describe('rootFrom', () => {
  it('returns the fallback when --root is absent', () => {
    expect(rootFrom([], fallback)).toBe(fallback);
    expect(rootFrom(['--check'], fallback)).toBe(fallback);
  });

  it('resolves the directory that follows --root', () => {
    expect(rootFrom(['--root', '/tmp/tree'], fallback)).toBe(
      resolve('/tmp/tree')
    );
  });

  it('rejects a bare --root rather than falling back silently', () => {
    expect(() => rootFrom(['--root'], fallback)).toThrow(UsageError);
    expect(() => rootFrom(['--root'], fallback)).toThrow(
      /--root needs a directory/
    );
  });

  it('rejects a --root whose value is swallowed from a flag', () => {
    expect(() => rootFrom(['--root', '--check'], fallback)).toThrow(
      /--root needs a directory/
    );
    expect(() => rootFrom(['--root', '-x'], fallback)).toThrow(
      /--root needs a directory/
    );
  });
});

describe('runsAsScript', () => {
  it('is false when the module is imported rather than launched', () => {
    expect(runsAsScript(import.meta.url)).toBe(false);
  });

  it('treats a module path that cannot be resolved as not the script', () => {
    expect(
      runsAsScript(new URL('./missing-module.ts', import.meta.url).href)
    ).toBe(false);
  });
});

describe('messageOf', () => {
  it('reads an Error message and stringifies anything else', () => {
    expect(messageOf(new Error('boom'))).toBe('boom');
    expect(messageOf('boom')).toBe('boom');
  });
});
