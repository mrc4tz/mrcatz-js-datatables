# Contributing

## Development

This is a [Bun](https://bun.sh) workspace with three packages (`packages/core`, `packages/server`, `packages/vue`) and a playground app (`apps/playground`).

```bash
bun install
bun run dev        # playground at http://localhost:5178 (in-memory data)
bun run test       # vitest: core, server, components
bun run typecheck
bun run build      # dist/ for all three packages
```

The build runs on the Bun runtime (`bun --bun`) because tsup 9 and Vite 8 need Node ≥ 20.19.

Please add a test for every new feature or bug fix, and keep `bun run test`, `bun run typecheck` and `bun run build` green.

## Publishing to npm

The packages depend on each other through plain semver ranges (not `workspace:*`), so they are safe to `npm publish` directly. Bun still links the local packages during development because the versions match.

```bash
npm login
# order matters: core first, because server & vue depend on it
cd packages/core   && npm publish --access public
cd ../server       && npm publish --access public
cd ../vue          && npm publish --access public
```

`prepublishOnly` runs the build automatically. For the next release, bump `version` in all three packages (and the `@mrc4tz/datatable-core` range in `server` and `vue` when the core API changes), then repeat the steps above. Check the tarball contents first with `npm pack --dry-run`.
