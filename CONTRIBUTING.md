# Contributing to Recap

Thank you for your interest in contributing. Recap is a small, focused library — contributions that keep it small and focused are most welcome.

## Local setup

```bash
git clone https://github.com/tonyarbor/recap-ux.git
cd recap-ux
npm install
npm run dev     # Starts the dev server with the example page at localhost:5173
```

## Running tests

```bash
npm test              # Run all tests once
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
npm run typecheck     # TypeScript type check (no emit)
```

All tests use Vitest with jsdom. Keep jsdom at v24 — v27 introduced ESM-only dependencies that are incompatible with Vitest's forks pool.

## Building

```bash
npm run build
```

This runs three steps in sequence:

1. `vite build` — main UMD/ESM/CJS bundles
2. `vite build --config vite.react.config.ts` — React wrapper sub-export
3. `tsc --emitDeclarationOnly` — TypeScript declaration files

## Commit message convention

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add scroll milestone tracking
fix: correct CSS selector generation for shadow DOM elements
docs: update configuration table in README
chore: bump vitest to 4.2
```

Types: `feat`, `fix`, `docs`, `test`, `chore`, `refactor`, `perf`.

Breaking changes: add `!` after the type (`feat!:`) and include a `BREAKING CHANGE:` footer.

## Pull request process

1. Open an issue first for any significant change — agree on the approach before writing code.
2. Keep PRs focused. One feature or fix per PR.
3. Ensure `npm test` and `npm run typecheck` both pass.
4. Update the README if you're changing user-facing behaviour.
5. The PR description should explain *why*, not just *what*.

## Questions

Open a [GitHub Discussion](https://github.com/tonyarbor/recap-ux/discussions) for questions, ideas, or anything that isn't a bug or feature request.
