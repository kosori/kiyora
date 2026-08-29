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

		storage.save('architecture\ntitle Restored');
		expect(w.localStorage.getItem(SOURCE_STORAGE_KEY)).toBe(
			'architecture\ntitle Restored'
		);
		expect(storage.load()).toBe('architecture\ntitle Restored');
	});

	test('overwrites the previous value when save is called again', () => {
		const { storage, clear } = freshStorage();
		clear();

		storage.save('first');
		storage.save('second');
		expect(storage.load()).toBe('second');
	});
});
