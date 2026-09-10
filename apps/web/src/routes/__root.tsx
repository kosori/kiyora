import { createRootRoute, HeadContent, Scripts } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';

import appCss from '../styles.css?url';

const TanStackDevtools =
	process.env.NODE_ENV === 'production'
		? () => null
		: lazy(() =>
				import('@tanstack/react-devtools').then((res) => ({
					default: res.TanStackDevtools,
				}))
			);

const TanStackRouterDevtoolsPanel =
	process.env.NODE_ENV === 'production'
		? () => null
		: lazy(() =>
				import('@tanstack/react-router-devtools').then((res) => ({
					default: res.TanStackRouterDevtoolsPanel,
				}))
			);

export const Route = createRootRoute({
	head: () => ({
		links: [
			{
				href: appCss,
				rel: 'stylesheet',
			},
		],
		meta: [
			{
				charSet: 'utf-8',
			},
			{
				content: 'width=device-width, initial-scale=1',
				name: 'viewport',
			},
			{
				title: 'Kiyora',
			},
		],
	}),
	shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang='en'>
			<head>
				<HeadContent />
			</head>
			<body>
				{children}
				<Suspense>
					<TanStackDevtools
						config={{
							position: 'bottom-right',
						}}
						plugins={[
							{
								name: 'Tanstack Router',
								render: <TanStackRouterDevtoolsPanel />,
							},
						]}
					/>
				</Suspense>
				<Scripts />
			</body>
		</html>
	);
}
