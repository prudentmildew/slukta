# Root tsconfig + frontend tsconfig improvements

## Goal

Introduce a shared TypeScript config at the monorepo root and tighten the
existing `apps/frontend` configs. Two concrete outcomes:

1. A `tsconfig.base.json` at the repo root holds options that are true for
   **all** TypeScript in the repo, so new packages can drop in without
   re-stating them.
2. A `tsconfig.json` at the repo root is a pure solution file
   (`{ files: [], references: [...] }`) so `tsc -b` from the root type-checks
   the whole monorepo in one shot.

The frontend configs become thinner — they keep only the options that are
genuinely bundler/DOM- or Node-specific, and extend the base for everything
else.

## File layout after the change

```
/tsconfig.base.json                  (new) universal compiler options
/tsconfig.json                       (new) pure solution, references apps/*
/apps/frontend/tsconfig.json         (unchanged) nested solution
/apps/frontend/tsconfig.app.json     (changed) extends base, keeps src/DOM options
/apps/frontend/tsconfig.node.json    (changed) extends base, keeps node options
```

Nested solutions (`tsconfig.json` at root → `apps/frontend/tsconfig.json` →
two leaves) are idiomatic and supported by `tsc -b`. The root stays agnostic
to each app's internal layout, so the pattern repeats cleanly when more
packages land.

## `tsconfig.base.json` (new)

```jsonc
{
  "compilerOptions": {
    /* Language + module semantics (true for all TS in the repo) */
    "target": "es2023",
    "module": "esnext",
    "moduleDetection": "force",
    "verbatimModuleSyntax": true,
    "erasableSyntaxOnly": true,
    "isolatedModules": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,

    /* Strictness */
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,

    /* Unused-symbol checks (see "Biome coexistence" below) */
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

### What is deliberately NOT in the base

These options are assumptions about *how a given package is built or run*,
not universal truths. They stay in the leaf configs so a future backend
package doesn't have to fight the base:

- `moduleResolution: bundler` — frontend-only; a Node backend will use
  `node16`/`nodenext`.
- `allowImportingTsExtensions: true` — pairs with bundler resolution.
- `noEmit: true` — frontend doesn't emit (Vite handles build); a backend
  package will emit.
- `lib`, `types`, `jsx` — differ per context (DOM vs. Node, React vs. not).
- `include`, `tsBuildInfoFile` — always per-package.

## `tsconfig.json` at the root (new)

Pure solution file — no `compilerOptions`, no `include`, nothing but
references. Lets `tsc -b` from the repo root walk the whole graph.

```jsonc
{
  "files": [],
  "references": [
    { "path": "./apps/frontend" }
  ]
}
```

## `apps/frontend/tsconfig.app.json` (changed)

Extends the base; keeps only what is genuinely bundler/DOM-specific.

```jsonc
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "types": ["vite/client"],
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src"]
}
```

## `apps/frontend/tsconfig.node.json` (changed)

Same treatment, for `vite.config.ts`.

```jsonc
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.node.tsbuildinfo",
    "lib": ["ES2023"],
    "types": ["node"],
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "noEmit": true
  },
  "include": ["vite.config.ts"]
}
```

## `apps/frontend/tsconfig.json` (unchanged)

Stays as the nested solution file it already is:

```jsonc
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

## Decisions and reasoning

| # | Decision | Chosen | Alternatives considered |
|---|---|---|---|
| 1 | Role of the root tsconfig | Both a shared base **and** a solution file | Base-only; solution-only; editor-only |
| 2 | Scope of the base | Universal options only — no bundler assumptions | Frontend-biased base; two bases (universal + bundler) |
| 3 | Strictness tier | `strict` + `noUncheckedIndexedAccess` + `noImplicitOverride` + `noImplicitReturns` | Baseline `strict` alone; maximal (adds `exactOptionalPropertyTypes` + `noPropertyAccessFromIndexSignature`) |
| 4 | Reference graph | Nested solutions — root references `apps/frontend/tsconfig.json` | Flatten (root references leaves directly); collapse frontend into one config |
| 5 | Extra non-strict flags | Add `forceConsistentCasingInFileNames` + `isolatedModules`; skip `allowUnreachableCode` / `allowUnusedLabels` (delegated to Biome) | Add all four; add none |

Why the strictness tier: the existing `src/App.tsx` is essentially empty, so
the migration cost of turning on aggressive strictness now is near zero.
`exactOptionalPropertyTypes` and `noPropertyAccessFromIndexSignature` were
left out because they tend to fight React / DefinitelyTyped types or catch
style rather than bugs. Easy to add later if a real bug justifies them.

Why `isolatedModules` alongside `verbatimModuleSyntax`: the two overlap but
aren't identical. `isolatedModules` enforces per-file transpilation
semantics that Vite/esbuild require; having both explicit is the safe
default for bundled code.

Why `forceConsistentCasingInFileNames`: dev happens on macOS (case-
insensitive FS); CI and most deploy targets are Linux (case-sensitive). The
flag catches `./App` vs. `./app` mismatches before they fail in CI.

## Known risk: `composite` on the leaves

The current leaves use `noEmit: true` and **no** `composite: true`. This
works today because recent TypeScript versions relax the `composite`
requirement for referenced projects when `noEmit` is set (`pnpm build`
already runs `tsc -b && vite build` successfully inside the frontend).

Adding a root-level solution that references `apps/frontend/tsconfig.json`
reuses the same traversal rules, so it *should* keep working. But if
`tsc -b` at the root errors with something like "referenced project must
have composite: true", the fix is one line per leaf:

```jsonc
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    // ...
  }
}
```

`composite: true` forces `declaration: true`, but because `noEmit: true`
is also set, no `.d.ts` files are actually written — it only affects the
incremental build graph. No other knock-on effects expected.

## Future: adding a backend package

The base is intentionally minimal so a backend (e.g. a Node service reading
`data/slukta.sqlite`) slots in without fighting anything frontend-specific:

1. Create `apps/backend/` with its own `package.json`.
2. `apps/backend/tsconfig.json` extends `tsconfig.base.json` and adds its
   own:
   - `moduleResolution: "node16"` (or `"nodenext"`)
   - **no** `noEmit` (backend emits JS for runtime)
   - `outDir`, `rootDir`
   - `lib: ["ES2023"]`, `types: ["node"]`
   - `composite: true` if it wants to be referenced by other packages
3. Add `{ "path": "./apps/backend" }` to the root `tsconfig.json`
   `references`.
4. Optionally split into `tsconfig.app.json` + `tsconfig.test.json` if the
   src/tests boundary is worth it — same nested-solution shape as the
   frontend.

Nothing in the base needs to change when this happens, and the frontend
configs are not touched. That's the payoff of keeping bundler assumptions
out of the base.

## Biome coexistence note

A couple of options (`noUnusedLocals`, `noUnusedParameters`) overlap with
Biome's `noUnusedVariables` and `noUnusedFunctionParameters`. The overlap
is intentional: TypeScript fails the *typecheck* step in CI on unused
symbols, which is a separate (and often faster) signal than lint. Keeping
them in tsconfig costs nothing and provides an extra tripwire.

Conversely, options like `allowUnreachableCode: false` and
`allowUnusedLabels: false` are pure dead-code/style checks with no type-
system angle. Those are delegated to Biome so that the tsconfig stays
focused on types and module semantics. If Biome is ever dropped, revisit.
