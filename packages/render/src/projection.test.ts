import { describe, expect, test } from 'bun:test';
import { isSafeUrl } from './projection';

describe('isSafeUrl', () => {
	test('allows valid web URLs and mailto links', () => {
		expect(isSafeUrl('https://example.com')).toBe(true);
		expect(isSafeUrl('http://example.com/page?query=1#hash')).toBe(true);
		expect(isSafeUrl('mailto:user@example.com')).toBe(true);
	});

	test('allows relative paths and fragments', () => {
		expect(isSafeUrl('/relative/path')).toBe(true);
		expect(isSafeUrl('relative/path')).toBe(true);
		expect(isSafeUrl('#fragment')).toBe(true);
		expect(isSafeUrl('./path')).toBe(true);
		expect(isSafeUrl('../path')).toBe(true);
	});

	test('blocks obvious dangerous protocols', () => {
		expect(isSafeUrl('javascript:alert(1)')).toBe(false);
		expect(isSafeUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
		expect(isSafeUrl('vbscript:msgbox(1)')).toBe(false);
		expect(isSafeUrl('file:///etc/passwd')).toBe(false);
	});

	test('blocks protocol obfuscation and bypass attempts', () => {
		expect(isSafeUrl('java\nscript:alert(1)')).toBe(false);
		expect(isSafeUrl(' java\tscript:alert(1)')).toBe(false);
		expect(isSafeUrl('javascript :alert(1)')).toBe(false);
	});
});
