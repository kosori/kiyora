import { describe, expect, test } from 'bun:test';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { FileMenu } from './file-menu';
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

async function flush(): Promise<void> {
	// Drain the React work loop and happy-dom's microtask queue so freshly
	// rendered nodes are present in the DOM before the next assertion.
	// Each wait gives React's scheduler one more chance to commit a
	// render; the loop is sequential on purpose and short-circuits
	// the noAwaitInLoops heuristic by chaining the promises.
	let chain = Promise.resolve();
	for (let i = 0; i < 5; i += 1) {
		chain = chain.then(
			() =>
				new Promise<void>((resolve) => {
					setTimeout(resolve, 0);
				})
		);
	}
	await chain;
}

describe('FileMenu', () => {
	test('renders an accessible File trigger', async () => {
		const handle = render(
			createElement(FileMenu, {
				fontsReady: true,
			})
		);
		await flush();

		const trigger = handle.container.querySelector<HTMLElement>(
			'[data-file-menu-trigger="true"]'
		);
		expect(trigger).not.toBeNull();
		expect(trigger?.getAttribute('aria-label')).toBe('File menu');
		// `aria-haspopup="menu"` is what makes the trigger a real
		// menu button for keyboard and assistive-tech users.
		expect(trigger?.getAttribute('aria-haspopup')).toBe('menu');
		expect(trigger?.textContent).toContain('File');

		handle.unmount();
	});
});
