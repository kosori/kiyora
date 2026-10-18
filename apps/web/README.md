# web

Next.js app for Kiyora.

## Getting Started

Run the development server from the repo root:

```sh
turbo dev --filter=web
```

Or from this directory:

```sh
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## UI

UI components come from [shadcn/ui](https://ui.shadcn.com/) on top of [Base UI](https://base-ui.com/). Add new components with:

```sh
bunx --bun shadcn@latest add <component>
```

Components live in `components/ui` and are imported with the `~/` alias, for example `~/components/ui/button`.

Icons come from [`@tabler/icons-react`](https://tabler.io/icons) (`iconLibrary: "tabler"` in `components.json`).

Theming tokens live in `app/globals.css`.

## Fonts

Fonts are loaded with [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) from local Geist files in `app/fonts`.
