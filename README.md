# Kiyora

Kiyora is an open-source diagram-as-code project for creating hand-drawn diagrams with a web-based canvas.

## Features

- **Diagram-focused web application**: A TanStack Start application built with React and TanStack Router
- **Shared UI system**: Reusable shadcn-style components built on Base UI primitives
- **Hand-drawn visual foundation**: Shared Tailwind CSS v4 theme tokens, rounded surfaces, pastel colors, and semantic design variables
- **Type-safe development**: Strict TypeScript configuration shared across workspaces
- **Monorepo workflow**: Turborepo tasks for development, builds, type checking, tests, and shared tooling
- **Code quality checks**: Biome and Ultracite for formatting, linting, and import organization
- **Continuous integration**: GitHub Actions checks the repository with Bun

The project currently does not include a database, API, or authentication system. The DSL and render packages include Bun test suites.

## Tech Stack

- **Runtime and package manager**: [Bun](https://bun.sh) `1.3.14`
- **Monorepo**: [Turborepo](https://turborepo.com)
- **Application framework**: [TanStack Start](https://tanstack.com/start) with [React](https://react.dev)
- **Routing**: [TanStack Router](https://tanstack.com/router) with file-based routes
- **Build tool**: [Vite](https://vite.dev)
- **Server output**: [Nitro](https://nitro.build)
- **Styling**: [Tailwind CSS](https://tailwindcss.com) v4
- **UI components**: [Base UI](https://base-ui.com) and [shadcn/ui](https://ui.shadcn.com) patterns
- **Icons**: [Tabler Icons](https://tabler.io/icons)
- **Code quality**: [Biome](https://biomejs.dev) through [Ultracite](https://www.ultracite.ai)
- **Type checking**: [TypeScript](https://www.typescriptlang.org)

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) `1.3.14`
- [Node.js](https://nodejs.org) 26 or newer

The repository includes a `mise.toml` file with the expected Bun and Node versions if you use [mise](https://mise.jdx.dev).

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/kosori/kiyora.git
   cd kiyora
   ```

2. Install dependencies:

   ```bash
   bun install
   ```

3. Start the development environment:

   ```bash
   bun run dev
   ```

   To start only the web application:

   ```bash
   bun run dev:web
   ```

The application does not currently require environment variables, a database, or external services for local development.

## Development

### Available Scripts

Run these commands from the repository root:

- `bun run dev` — Start all development tasks through Turborepo
- `bun run dev:web` — Start only the web application
- `bun run build` — Build all workspaces with a build task
- `bun run check` — Run Biome and Ultracite checks
- `bun run fix` — Apply safe formatting and lint fixes
- `bun run typecheck` — Type check all applicable workspaces
- `bun run ui-add` — Add a shared UI component through the shadcn CLI

Web application commands:

- `bun --cwd apps/web run generate-routes` — Generate TanStack Router's route tree
- `bun --cwd apps/web run build` — Build only the web application
- `bun --cwd apps/web run preview` — Preview the web application's production build

Run the monorepo test suite with `bunx turbo run test`. Package-level tests are available with `bun test packages/dsl` and `bun test packages/render`.

### Verification

Before opening a pull request or committing a significant change, run:

```bash
bun run check
bun run typecheck
bun run build
bunx turbo run test
```

GitHub Actions runs the same checks using the repository's Bun setup action.

## Project Structure

```text
.
├── apps/
│   └── web/                       # TanStack Start web application
│       └── src/
│           ├── routes/             # File-based TanStack Router routes
│           ├── router.tsx          # Router creation and registration
│           ├── routeTree.gen.ts    # Generated route tree
│           └── styles.css          # Application Tailwind entry point
├── packages/
│   └── ui/                        # Shared Base UI and shadcn-style components
│       ├── src/components/         # Reusable UI components
│       ├── src/hooks/              # Shared UI hooks
│       └── src/index.ts            # Shared class-name utilities
├── tooling/
│   ├── github/                    # Reusable GitHub Actions setup
│   ├── tailwind/                  # Shared Tailwind theme and PostCSS config
│   └── typescript/                # Shared TypeScript configurations
├── .github/workflows/             # Continuous integration workflows
├── AGENTS.md                      # Guidelines for coding agents
├── biome.jsonc                    # Biome and Ultracite configuration
├── bun.lock                       # Bun lockfile
├── mise.toml                      # Local Bun and Node versions
└── turbo.json                     # Turborepo task configuration
```

### Architecture Notes

- Application-specific code belongs in `apps/web`.
- Reusable, product-agnostic UI primitives belong in `packages/ui`.
- Shared Tailwind and TypeScript configuration belongs in `tooling/`.
- Shared packages must not import from the web application.
- `apps/web/src/routeTree.gen.ts` is generated and should not be edited manually.

## Contributing

1. Read the project conventions in [`AGENTS.md`](AGENTS.md).
2. Keep changes scoped to the requested feature or fix.
3. Use the existing workspace packages and configuration before introducing new abstractions.
4. Run the verification commands before submitting a change:

   ```bash
   bun run check
   bun run typecheck
   bun run build
   ```

5. Update documentation when commands, workspace boundaries, or development requirements change.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
