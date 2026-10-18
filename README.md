# Kiyora

## What's inside?

This Turborepo includes the following packages/apps:

### Apps and Packages

- `@kiyora/web`: a [Next.js](https://nextjs.org/) app using [shadcn/ui](https://ui.shadcn.com/) with the [Base UI](https://base-ui.com/) primitives

### Tooling

- `@kiyora/typescript`: `tsconfig.json`s used throughout the monorepo

Each package/app is 100% [TypeScript](https://www.typescriptlang.org/).

### Utilities

This Turborepo has some additional tools already setup for you:

- [TypeScript](https://www.typescriptlang.org/) for static type checking
- [Tailwind CSS](https://tailwindcss.com/) v4 for styling
- [Ultracite](https://www.ultracite.ai/) with [Biome](https://biomejs.dev/) for linting and formatting (configured once at the repo root)

### Build

To build all apps and packages, run the following command:

```sh
turbo build
```

You can build a specific package by using a [filter](https://turborepo.dev/docs/crafting-your-repository/running-tasks#using-filters):

```sh
turbo build --filter=@kiyora/web
```

### Develop

To develop all apps and packages, run the following command:

```sh
turbo dev
```

You can develop a specific package by using a [filter](https://turborepo.dev/docs/crafting-your-repository/running-tasks#using-filters):

```sh
turbo dev --filter=@kiyora/web
```

### Remote Caching

> [!TIP]
> Vercel Remote Cache is free for all plans. Get started today at [vercel.com](https://vercel.com/signup?utm_source=remote-cache-sdk&utm_campaign=free_remote_cache).

Turborepo can use a technique known as [Remote Caching](https://turborepo.dev/docs/core-concepts/remote-caching) to share cache artifacts across machines, enabling you to share build caches with your team and CI/CD pipelines.

By default, Turborepo will cache locally. To enable Remote Caching you will need an account with Vercel. If you don't have an account you can [create one](https://vercel.com/signup?utm_source=remote-cache-sdk&utm_campaign=free_remote_cache), then enter the following commands:

```sh
turbo login
```

Next, you can link your Turborepo to your Remote Cache by running the following command from the root of your Turborepo:

```sh
turbo link
```

## Useful Links

Learn more about the power of Turborepo:

- [Tasks](https://turborepo.dev/docs/crafting-your-repository/running-tasks)
- [Caching](https://turborepo.dev/docs/crafting-your-repository/caching)
- [Remote Caching](https://turborepo.dev/docs/core-concepts/remote-caching)
- [Filtering](https://turborepo.dev/docs/crafting-your-repository/running-tasks#using-filters)
- [Configuration Options](https://turborepo.dev/docs/reference/configuration)
- [CLI Usage](https://turborepo.dev/docs/reference/command-line-reference)
