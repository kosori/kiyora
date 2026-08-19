import { createRouter as createTanStackRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';

export function getRouter() {
	const router = createTanStackRouter({
		defaultPreload: 'intent',
		defaultPreloadStaleTime: 0,
		routeTree,
		scrollRestoration: true,
	});

	return router;
}

declare module '@tanstack/react-router' {
	// biome-ignore lint/style/useConsistentTypeDefinitions: "tanstack start pattern"
	interface Register {
		router: ReturnType<typeof getRouter>;
	}
}
