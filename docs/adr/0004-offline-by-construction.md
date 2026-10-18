# Offline by construction

The editor makes no network request other than fetching its own assets from localhost, and a test enforces it by aborting everything else. No account, no sync, no telemetry, no remote fonts, no remote icons, no CDN.

An offline claim that is only a promise decays the first time a dependency phones home or someone adds an analytics tag. Making it a test turns the claim into a property: the build either keeps it or goes red.

Note that "offline" is about the editor's behaviour, not about how the app is served. `apps/web` runs a normal Next.js server, because v2 needs auth, an assistant proxy and MCP, and `output: 'export'` would forbid all three. Offline means the board keeps working when the network is gone.

## Consequences

- The font bytes are committed, not fetched.
- Icons, when they arrive in v1.5, are a committed dataset, lazily loaded.
- Every new dependency is a candidate for a request; the guard is what makes that checkable.
