# Root biome + per-app biome configuration

## Goal

Establish a "shared base at root, thin per-app configs" shape for Biome that
mirrors the pattern already adopted for TypeScript (`docs/ideas/tsconfig-setup.md`).
Two concrete outcomes:

1. The existing root `biome.json` becomes the **shared base** — every
   universal formatter/linter setting lives here and applies to every
   package without restatement.
2. Each app grows a minimal `biome.json` with `"root": false`, making it a
   Biome-native **nested configuration** that merges with the root. Today
   the frontend's config is a stub; it exists as a scaffolded hook for
   future per-app overrides (React-specific rules, backend Node rules,
   per-app ignore patterns) rather than for current divergence.

The primary driver is symmetry with the tsconfig layout and anticipating a
future backend package that will want different lint rules than the
frontend. Per-app CLI ergonomics and per-app ignore patterns are downstream
benefits, not motivations.

## File layout after the change

```
/biome.json                          (unchanged) shared base, "root": true implicit
/apps/frontend/biome.json            (new) "root": false, empty overrides
```

## Mechanism: nested configurations, not `extends`

Biome supports two inheritance mechanisms:

- **`extends`** — tsconfig-style explicit inheritance: a child config names
  its parent via `"extends": ["../../biome.json"]`.
- **`"root": false` nested configurations** — introduced in Biome 2.0 for
  exactly this monorepo shape. A config declared non-root is merged into
  its ancestor root config, and a single `biome check` from the repo root
  discovers and applies the correct merged config per file.

We use the nested-config mechanism. Unlike TypeScript — which only has
`extends` — Biome was designed for this shape, and one `biome check` from
root covers every package without `--config-path` juggling or fanning out
through `pnpm -r`. The cost is one piece of Biome-specific knowledge
(what `"root": false` means); the benefit is that the CLI "just works"
monorepo-wide.

## `biome.json` at the root (unchanged)

No content moves. Everything currently in the root is universal:

- `vcs` (git + `useIgnoreFile`) — repo-level concern.
- `files.ignoreUnknown: false` — universal.
- `formatter.indentStyle: tab` — house style.
- `linter.rules.recommended: true` — baseline for every package.
- `javascript.formatter.quoteStyle: single` — applies equally to a future
  Node backend.
- `assist.actions.source.organizeImports: on` — universal.

## `apps/frontend/biome.json` (new)

```jsonc
{
  "$schema": "https://biomejs.dev/schemas/2.4.12/schema.json",
  "extends": "//"
}
```

`"extends": "//"` is load-bearing: without it the file would be treated as
an independent root and would **not** inherit from the repo-root config.
`$schema` is required here (not inheritable) so editors can validate and
autocomplete against the installed Biome version.

### What is deliberately NOT in the frontend config

Mirroring the tsconfig doc's discipline of keeping leaves empty until
there is a real driver:

- No `jsxQuoteStyle` — default `"double"` is conventional.
- No React-specific lints — `recommended: true` already pulls in
  `useExhaustiveDependencies`, `useHookAtTopLevel`, etc.
- No `files.includes` — the frontend doesn't need to scope Biome's walk.
- No `overrides` — no per-file-type divergence exists yet.

Add these only when a concrete need appears.

## Scripts

Add two scripts to the **root** `package.json`:

```jsonc
"scripts": {
  "dev": "pnpm -r run dev",
  "test": "pnpm -r run test",
  "build": "pnpm -r run build",
  "check": "biome check",
  "check:fix": "biome check --write"
}
```

Note the deviation from the `pnpm -r` fan-out used by `dev`/`build`/`test`:
those commands fan out because each app genuinely has different tooling.
Biome understands the whole monorepo in one process; fanning out would
spawn N biome invocations without a payoff. The tsconfig setup makes the
same call implicitly — `tsc -b` at the root walks the reference graph in
one shot.

`biome ci` (stricter, non-writing) and split `format`/`lint` scripts are
skipped until a real driver (actual CI, pre-commit hook) appears.

## Decisions and reasoning

| # | Decision | Chosen | Alternatives considered |
|---|---|---|---|
| 1 | Motivation | Symmetry with tsconfig + anticipating backend divergence | CLI ergonomics-first; per-app ignores-first |
| 2 | Inheritance mechanism | `"root": false` nested configs | `extends` (tsconfig-style); both combined |
| 3 | What moves from root into the frontend config | Nothing | Preemptively move `jsxQuoteStyle`, React lints, etc. |
| 4 | Script placement | Single root invocation (`biome check` at repo root) | Fan out via `pnpm -r`; no scripts |
| 5 | `$schema` version handling | Accept lockstep bumps | Unversioned `latest` URL; drop `$schema` |

Why the nested-config mechanism rather than `extends`: TypeScript only
offers `extends`, so the tsconfig doc had to use it. Biome has a
purpose-built monorepo feature that is strictly better for this shape.
The spirit of the tsconfig pattern ("packages drop in without restating
shared options") is preserved either way.

Why nothing moves from root to frontend today: the tsconfig idea doc put
things in the leaves only when they were genuinely local to a package
(`moduleResolution: bundler`, DOM `lib`, `jsx: react-jsx`). Applied to
Biome, none of the current root settings are frontend-specific — they
would apply equally to a future backend. Moving them would be speculative.

Why single root invocation rather than `pnpm -r` fan-out: Biome is one
tool that walks the whole repo efficiently in a single process. The
fan-out pattern pays off when each package uses different tooling; with a
shared tool it just multiplies process overhead.

Why a versioned `$schema` URL: forces the reader to notice the Biome
version when it bumps in the catalog, and keeps IDE validation aligned
with the installed Biome. An unversioned `latest` URL would silently
drift from the installed version; dropping `$schema` would cost IDE
autocomplete.

## Known risk: `ignoreUnknown: false` and `data/`

The root config has `"files": { "ignoreUnknown": false }`, and the repo
contains `data/slukta.sqlite` (a binary file held for a future backend).
Biome has never been run at scale in this repo, so the first `pnpm check`
may surface diagnostics for unrecognized file types that have so far
been invisible.

If this happens, the fix is one of:

- Set `"ignoreUnknown": true` at the root — simple, but loses the tripwire
  for genuinely unexpected file types the repo picks up.
- Add an explicit ignore for `data/`, e.g.
  `"files": { "includes": ["**", "!data/**"] }` at the root, scoping
  Biome's walk away from binary storage.

Prefer the second when the issue concretely appears. Don't preemptively
ignore `data/` — let the first run tell us whether biome already skips
binaries silently.

## Future: adding a backend package

The shape is intentionally minimal so a backend (e.g. a Node service
reading `data/slukta.sqlite`) slots in cleanly:

1. Create `apps/backend/` with its own `package.json`.
2. Add `apps/backend/biome.json` with `"root": false` and whatever
   backend-specific overrides the package wants — e.g. turning off
   `noConsole` for a server, adding Node-specific lint rules, or
   scoping `files.includes` to `src/**/*.ts`.
3. Nothing in the root `biome.json` needs to change.
4. `pnpm check` at the root keeps working; it picks up the new nested
   config automatically.

When (if) the per-app overrides in frontend and backend start to diverge
in a meaningful way, that's the moment to revisit what belongs in the
root base — not before.

## Coexistence with tsconfig

Biome and TypeScript overlap on a couple of checks (`noUnusedLocals` /
`noUnusedParameters` in tsconfig vs. Biome's `noUnusedVariables` /
`noUnusedFunctionParameters`). This overlap is intentional and already
discussed in `docs/ideas/tsconfig-setup.md` — TypeScript catches these at
typecheck time, Biome catches them at lint time, and both tripwires are
cheap. No action needed here; the two tools configure independently and
don't read each other's files.
