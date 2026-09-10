import { describe, expect, test } from 'bun:test';
import { browserSourceStorage, SOURCE_STORAGE_KEY } from './source-storage';
import { withHappyDom } from './test-happy-dom';

function freshStorage(): {
	storage: ReturnType<typeof browserSourceStorage>;
	clear: () => void;
} {
	const { w } = withHappyDom();
	const storage = browserSourceStorage();
	const ls = w.localStorage;
	return {
		clear: () => {
			ls.clear();
		},
		storage,
	};
}

describe('browserSourceStorage', () => {
	test('returns null when nothing has been stored yet', () => {
		const { storage, clear } = freshStorage();
		clear();
		expect(storage.load()).toBeNull();
	});

	test('round-trips a Source value through the agreed key', () => {
		const { w } = withHappyDom();
		const storage = browserSourceStorage();
		w.localStorage.clear();

		const saved = storage.save('architecture\ntitle Restored');
		expect(saved).toBe(true);
		expect(w.localStorage.getItem(SOURCE_STORAGE_KEY)).toBe(
			'architecture\ntitle Restored'
		);
		expect(storage.load()).toBe('architecture\ntitle Restored');
	});

	test('overwrites the previous value when save is called again', () => {
		const { storage, clear } = freshStorage();
		clear();

		expect(storage.save('first')).toBe(true);
		expect(storage.save('second')).toBe(true);
		expect(storage.load()).toBe('second');
	});

	test('returns false when storage.setItem throws (quota exceeded or disabled)', () => {
		const { w } = withHappyDom();
		const storage = browserSourceStorage();
		Object.defineProperty(w.localStorage, 'setItem', {
			configurable: true,
			value: () => {
				throw new Error('QuotaExceededError');
			},
		});

		expect(storage.save('architecture\ntitle Oversized')).toBe(false);
	});
});
