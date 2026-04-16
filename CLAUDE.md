# CLAUDE.md

Guidance for Claude Code (claude.ai/code) working in this repo.

## Commands

Run from the repo root; scripts fan out to workspaces via `pnpm -r`:

- `pnpm dev` — start dev servers (currently just `apps/frontend` → Vite)
- `pnpm build` — build every package (frontend: `tsc -b && vite build`)
- `pnpm test` — no-op until a test runner is wired up

Target a single package with pnpm's filter syntax, e.g. `pnpm --filter @slukta/frontend dev`.

**Pinned toolchain:** pnpm 10.33.0, Node ≥25.9.0 (`engine-strict=true`). Use pnpm — `pnpm-lock.yaml` and the workspace catalog won't resolve with npm/yarn.

## Architecture

**Monorepo.** pnpm workspace with packages under `apps/*`. `data/` is excluded from the workspace and holds `slukta.sqlite` — the datastore for a future backend. Only `apps/frontend` exists today.

**Shared dep versions via pnpm catalog.** `pnpm-workspace.yaml` defines a `catalog:` block for `@types/node` and `typescript`; packages reference them as `"typescript": "catalog:"`. Bump the catalog, not individual `package.json` files.

**Frontend (`apps/frontend`, `@slukta/frontend`)** — React 19 + Vite 8 + TypeScript:

- **React Compiler is enabled** via `@vitejs/plugin-react` + `@rolldown/plugin-babel` running `reactCompilerPreset()` (`vite.config.ts`). Memoization is handled by the compiler — don't add `useMemo`/`useCallback` without a measured reason.
- **TypeScript uses project refs.** `apps/frontend/tsconfig.json` references `tsconfig.app.json` (`src/`) and `tsconfig.node.json` (Vite config); `tsc -b` drives the build. Notable strict options: `verbatimModuleSyntax`, `erasableSyntaxOnly`, `noUnusedLocals`, `noUnusedParameters`.
- Entry points: `index.html` → `src/main.tsx` → `src/App.tsx`. Static assets in `public/` (absolute paths, e.g. `/icons.svg#foo`) and `src/assets/` (module imports).
