/**
 * The four ways storage can fail, kept distinct because the person who sees one
 * has to do a different thing from the person who sees another: free some space,
 * unblock the site, read the board that was set aside, or stop expecting a save.
 * Collapsing them into "storage error" would hide the one instruction that
 * helps.
 */
export type StorageFault =
  | { kind: 'quota' }
  | { kind: 'blocked' }
  | { kind: 'unavailable' }
  | { kind: 'corrupt'; reason: CorruptReason };

/**
 * Why stored bytes could not be read. `newer` is a board from a later release,
 * `migration` is a payload this code failed to lift, and `damaged` is anything
 * else that will not parse as a board.
 */
export type CorruptReason = 'damaged' | 'newer' | 'migration';

/**
 * A storage failure carrying its fault, so the engine can tell a quota from a
 * block without inspecting a browser exception. The browser adapters in the app
 * throw this; nothing below this line knows what a `DOMException` is.
 */
export class StorageError extends Error {
  readonly fault: StorageFault;

  constructor(fault: StorageFault, options?: { cause?: unknown }) {
    super(`storage ${fault.kind}`, options);
    this.name = 'StorageError';
    this.fault = fault;
  }
}

/**
 * The fault behind an error. A `StorageError` names its own; anything else is
 * unexpected, and the only honest state for it is `unavailable`.
 */
export const faultOf = (error: unknown): StorageFault =>
  error instanceof StorageError ? error.fault : { kind: 'unavailable' };
