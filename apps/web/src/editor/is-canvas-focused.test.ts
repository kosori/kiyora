import { describe, expect, test } from 'bun:test';
import { isCanvasFocused } from './is-canvas-focused';
import { withHappyDom } from './test-happy-dom';

describe('isCanvasFocused', () => {
	test('returns false when nothing is focused', () => {
		withHappyDom();
		expect(isCanvasFocused()).toBe(false);
	});

	test('returns true when the canvas host is the active element', () => {
		const { d } = withHappyDom();
		const canvas = d.createElement('div');
		canvas.setAttribute('data-kiyora-canvas', '');
		canvas.tabIndex = 0;
		d.body.append(canvas);
		canvas.focus();
		expect(isCanvasFocused()).toBe(true);
	});

	test('returns true when a descendant of the canvas host is focused', () => {
		const { d } = withHappyDom();
		const canvas = d.createElement('div');
		canvas.setAttribute('data-kiyora-canvas', '');
		const inner = d.createElement('button');
		canvas.append(inner);
		d.body.append(canvas);
		inner.focus();
		expect(isCanvasFocused()).toBe(true);
	});

	test('returns false when a textarea is the active element', () => {
		const { d } = withHappyDom();
		const textarea = d.createElement('textarea');
		d.body.append(textarea);
		textarea.focus();
		expect(isCanvasFocused()).toBe(false);
	});

	test('returns false when another focusable control is the active element', () => {
		const { d } = withHappyDom();
		const button = d.createElement('button');
		d.body.append(button);
		button.focus();
		expect(isCanvasFocused()).toBe(false);
	});

	test('returns false when document is undefined (SSR guard)', () => {
		const target = globalThis as { document?: unknown };
		const previousDocument = target.document;
		target.document = undefined;
		try {
			expect(isCanvasFocused()).toBe(false);
		} finally {
			target.document = previousDocument;
		}
	});
});
