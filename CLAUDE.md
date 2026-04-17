# CLAUDE.md
## Commands
Run from repo root. Scripts fan out via `pnpm -r`:
- `pnpm dev` — start dev servers (frontend → Vite)
- `pnpm build` — build all packages (frontend: `tsc -b && vite build`)
- `pnpm test` — no test runner yet
Filter: `pnpm --filter @slukta/frontend dev`
**Toolchain:** pnpm 10.33.0, Node ^25.9.0 (`engine-strict=true`). Always use pnpm.
## Architecture
**Monorepo.** pnpm workspace (`apps/*`). `data/` excluded via `!data/*`, holds `slukta.sqlite` for a future backend. Only `apps/frontend` exists today.
**Database:** reverse-engineered schema reference for `data/slukta.sqlite` is in `docs/ideas/database-schema.md` — use it before writing queries or designing backend models.
**pnpm catalog** (`pnpm-workspace.yaml`): shared versions for `typescript`, `@types/node`, `@biomejs/biome`. Packages use `"catalog:"` references. Bump catalog, not individual `package.json`.
**TypeScript:** `tsconfig.base.json` at repo root defines shared strict settings (`strict`, `verbatimModuleSyntax`, `erasableSyntaxOnly`, `noUnusedLocals`, `noUnusedParameters`, `noUncheckedIndexedAccess`). Per-package tsconfigs extend it. Root `tsconfig.json` holds project references; `tsc -b` drives builds.
**Frontend (`apps/frontend`, `@slukta/frontend`)** — React 19 + Vite 8 + TypeScript:
- **React Compiler enabled** via `@vitejs/plugin-react` + `@rolldown/plugin-babel` + `reactCompilerPreset()`. Don't add `useMemo`/`useCallback` without a measured reason.
- `tsconfig.json` references `tsconfig.app.json` (src) and `tsconfig.node.json` (Vite config).
- Entry: `index.html` → `src/main.tsx` → `src/App.tsx`. Static assets in `public/` (absolute paths) and `src/assets/` (module imports).
