import { describe, expect, mock, test } from 'bun:test';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { FileStatus } from './file-status';
import { withHappyDom } from './test-happy-dom';

(
	globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

type RenderHandle = {
	container: Element;
	root: Root;
	unmount: () => void;
};

function render(element: React.ReactNode): RenderHandle {
	const { d } = withHappyDom();
	const container = d.createElement('div');
	d.body.append(container);
	const root = createRoot(container as unknown as Element);
	act(() => {
		root.render(element);
	});
	return {
		container,
		root,
		unmount() {
			act(() => {
				root.unmount();
			});
			container.remove();
		},
	};
}

function flush(): Promise<void> {
	let chain = Promise.resolve();
	for (let i = 0; i < 3; i += 1) {
		chain = chain.then(
			() =>
				new Promise<void>((resolve) => {
					setTimeout(resolve, 0);
				})
		);
	}
	return chain;
}

describe('FileStatus', () => {
	test('renders nothing visible when there is no error and no shortcuts set', async () => {
		const handle = render(
			createElement(FileStatus, { onDismiss: () => undefined })
		);
		await flush();

		const footer = handle.container.querySelector('[data-file-status]');
		expect(footer).toBeNull();

		handle.unmount();
	});

	test('shows the static shortcut hints in the footer', async () => {
		const handle = render(
			createElement(FileStatus, {
				onDismiss: () => undefined,
				shortcuts: ['⌘S Save', '⌘O Open'],
			})
		);
		await flush();

		const footer = handle.container.querySelector('[data-file-status]');
		expect(footer).not.toBeNull();
		expect(footer?.getAttribute('role')).toBe(null);
		expect(footer?.textContent).toContain('⌘S Save');
		expect(footer?.textContent).toContain('⌘O Open');

		handle.unmount();
	});

	test('shows the error with an accessible alert role when message is set', async () => {
		const handle = render(
			createElement(FileStatus, {
				errorMessage: '"diagram.txt" is not a .kira file.',
				onDismiss: () => undefined,
				shortcuts: ['⌘S Save'],
			})
		);
		await flush();

		const alert = handle.container.querySelector('[data-file-status-error]');
		expect(alert).not.toBeNull();
		expect(alert?.getAttribute('role')).toBe('alert');
		expect(alert?.textContent).toContain('"diagram.txt" is not a .kira file.');

		handle.unmount();
	});

	test('exposes a dismiss button that calls onDismiss', async () => {
		const onDismiss = mock(() => undefined);
		const handle = render(
			createElement(FileStatus, {
				errorMessage: 'Open failed.',
				onDismiss,
				shortcuts: [],
			})
		);
		await flush();

		const button = handle.container.querySelector<HTMLButtonElement>(
			'[data-file-status-dismiss]'
		);
		expect(button).not.toBeNull();
		expect(button?.getAttribute('aria-label')).toBe('Dismiss file error');

		button?.click();

		expect(onDismiss).toHaveBeenCalledTimes(1);

		handle.unmount();
	});

	test('does not render a dismiss button when there is no error', async () => {
		const handle = render(
			createElement(FileStatus, {
				onDismiss: () => undefined,
				shortcuts: ['⌘S Save'],
			})
		);
		await flush();

		const button = handle.container.querySelector('[data-file-status-dismiss]');
		expect(button).toBeNull();

		handle.unmount();
	});
});
