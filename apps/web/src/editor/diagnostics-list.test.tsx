import { describe, expect, test } from 'bun:test';
import type { Diagnostic } from '@kiyora/dsl';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { DiagnosticsList } from './diagnostics-list';
import { withHappyDom } from './test-happy-dom';

(
	globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const span = { end: { column: 5, line: 1 }, start: { column: 1, line: 1 } };

function mount(diagnostics: Diagnostic[]): {
	container: HTMLElement;
	unmount: () => void;
} {
	const { d } = withHappyDom();
	const container = d.createElement('div');
	d.body.append(container);
	const root = createRoot(container as unknown as Element);
	act(() => {
		root.render(createElement(DiagnosticsList, { diagnostics }));
	});
	return {
		container,
		unmount: () => {
			act(() => {
				root.unmount();
			});
		},
	};
}

describe('DiagnosticsList', () => {
	test('shows an OK message for an empty diagnostics list', () => {
		const { container, unmount } = mount([]);

		const list = container.querySelector('[data-diagnostics]');
		expect(list).not.toBeNull();
		expect(list?.getAttribute('data-state')).toBe('ok');
		expect(list?.textContent).toContain('OK');

		unmount();
	});

	test('renders a list of diagnostic rows with severity colors and line:col', () => {
		const diagnostics: Diagnostic[] = [
			{
				code: 'unknown-shape',
				message: 'Unknown shape "circle".',
				severity: 'error',
				span: { end: { column: 18, line: 3 }, start: { column: 12, line: 3 } },
			},
			{
				code: 'attribute-ignored',
				message: 'Attribute "striped" is not recognized.',
				severity: 'warning',
				span: { end: { column: 24, line: 7 }, start: { column: 16, line: 7 } },
			},
		];
		const { container, unmount } = mount(diagnostics);

		const list = container.querySelector('[data-diagnostics]');
		expect(list?.getAttribute('data-state')).toBe('error');

		const rows = container.querySelectorAll('[data-diagnostic]');
		expect(rows).toHaveLength(2);

		const errorRow = rows[0] as HTMLElement;
		expect(errorRow.getAttribute('data-severity')).toBe('error');
		expect(errorRow.textContent).toContain('3:12');
		expect(errorRow.textContent).toContain('unknown-shape');
		expect(errorRow.textContent).toContain('Unknown shape "circle".');

		const warningRow = rows[1] as HTMLElement;
		expect(warningRow.getAttribute('data-severity')).toBe('warning');
		expect(warningRow.textContent).toContain('7:16');
		expect(warningRow.textContent).toContain('attribute-ignored');

		unmount();
	});

	test('marks the list as a warning when only warnings are present', () => {
		const diagnostics: Diagnostic[] = [
			{
				code: 'attribute-ignored',
				message: 'Attribute "striped" is not recognized.',
				severity: 'warning',
				span,
			},
		];
		const { container, unmount } = mount(diagnostics);

		const list = container.querySelector('[data-diagnostics]');
		expect(list?.getAttribute('data-state')).toBe('warning');

		unmount();
	});
});
