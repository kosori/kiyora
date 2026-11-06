/**
 * The fault vocabulary lives in `model` so `sync` can name a storage fault
 * without importing `editor`; this module keeps the persistence imports working.
 */
// biome-ignore lint/performance/noBarrelFile: keeps the editor's existing persistence imports working now that the vocabulary lives in model.
export {
  type CorruptReason,
  faultOf,
  StorageError,
  type StorageFault,
} from '@kiyora/model';
