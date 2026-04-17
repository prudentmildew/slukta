# CLAUDE.md
## Commands
Run from repo root. Scripts fan out via `pnpm -r`:
- `pnpm dev` — start dev servers (frontend → Vite, backend → `node --watch`)
- `pnpm build` — build all packages
- `pnpm test` — backend: `node --test dist/**/*.test.js`; frontend: no test runner yet
- `pnpm check` / `pnpm check:fix` — Biome lint + format
Filter: `pnpm --filter @slukta/frontend dev`
**Toolchain:** pnpm 10.33.0, Node ^25.9.0 (`engine-strict=true`). Always use pnpm.
## Architecture
**Monorepo.** pnpm workspace (`apps/*`). `data/` excluded via `!data/*`, holds `slukta.sqlite`.
**Database:** reverse-engineered schema reference in `docs/ideas/database-schema.md` — use it before writing queries or designing backend models.
**pnpm catalog** (`pnpm-workspace.yaml`): shared versions for `typescript`, `@types/node`, `@biomejs/biome`. Packages use `"catalog:"` references. Bump catalog, not individual `package.json`.
**Biome:** root `biome.json` — single quotes, 2-space indent, recommended lint rules, organize imports. Ignores `routeTree.gen.ts`.
**TypeScript:** `tsconfig.base.json` defines shared strict settings (`strict`, `verbatimModuleSyntax`, `erasableSyntaxOnly`, `noUnusedLocals`, `noUnusedParameters`, `noUncheckedIndexedAccess`). Per-package tsconfigs extend it. Root `tsconfig.json` holds project references; `tsc -b` drives builds.
**Backend (`apps/backend`, `@slukta/backend`)** — pure Node.js + TypeScript, no frameworks:
- Uses Node.js built-in `DatabaseSync` from `node:sqlite`. Schema in `src/schema.sql`.
- Entry: `src/main.ts`. Build output: `dist/`. Module: NodeNext.
- Scripts: `build` (tsc -b), `dev` (node --watch dist/main.js), `seed` (node dist/seed.js).
**Frontend (`apps/frontend`, `@slukta/frontend`)** — React 19 + Vite 8 + TypeScript:
- **TanStack Router** for routing. `@tanstack/router-plugin` auto-generates `routeTree.gen.ts` with `autoCodeSplitting`. Route files in `src/routes/`.
- **React Compiler enabled** via `@vitejs/plugin-react` + `@rolldown/plugin-babel` + `reactCompilerPreset()`. Don't add `useMemo`/`useCallback` without a measured reason.
- Entry: `index.html` → `src/main.tsx` (creates router, renders `<RouterProvider>`). Static assets in `public/` (absolute paths) and `src/assets/` (module imports).
