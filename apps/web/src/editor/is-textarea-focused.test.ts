import { describe, expect, test } from 'bun:test';
import { isTextareaFocused } from './is-textarea-focused';
import { withHappyDom } from './test-happy-dom';

describe('isTextareaFocused', () => {
	test('returns false when nothing is focused', () => {
		withHappyDom();
		expect(isTextareaFocused()).toBe(false);
	});

	test('returns true when a textarea is the active element', () => {
		const { d } = withHappyDom();
		const textarea = d.createElement('textarea');
		d.body.append(textarea);
		textarea.focus();
		expect(isTextareaFocused()).toBe(true);
	});

	test('returns false when a non-textarea element is focused', () => {
		const { d } = withHappyDom();
		const div = d.createElement('div');
		d.body.append(div);
		div.focus();
		expect(isTextareaFocused()).toBe(false);
	});

	test('returns false when document is undefined (SSR guard)', () => {
		const target = globalThis as { document?: unknown };
		const previousDocument = target.document;
		target.document = undefined;
		try {
			expect(isTextareaFocused()).toBe(false);
		} finally {
			target.document = previousDocument;
		}
	});
});
