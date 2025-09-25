# Repository Guidelines

## Project Structure & Module Organization
AuthzKit is a pnpm workspace monorepo:
- `packages/core` — type-safe policy engine + shared utilities.
- `packages/prisma-tenant-guard` — tenant guard extension, generator, CLI, Zod helpers.
- `packages/adapters/*` — Prisma, Drizzle, Kysely, Next.js, and RPC integrations.
- `docs/`, `stories/` — guides, reference snippets, UI guard demos.
- `.changeset/` — release notes; `.github/` — CI workflows + templates.
Tests live beside sources: `*.spec.ts`, `*.test-d.ts`.

## Build, Test, and Development Commands
Run from repo root after `pnpm install`:
- `pnpm build` — compile all packages via tsup.
- `pnpm dev` — watch packages and run Vitest in parallel.
- `pnpm lint` — ESLint + Prettier checks; `pnpm format` to fix.
- `pnpm test` — Vitest with coverage thresholds.
- `pnpm typecheck` — strict TypeScript validation.
- `pnpm release` — publish via Changesets (maintainers only).

## Coding Style & Naming Conventions
- 2-space indentation, trailing commas, ESM-first imports.
- TypeScript strict mode with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`.
- Naming: `camelCase` (vars/functions), `PascalCase` (types/components), `kebab-case` (packages).
- Keep policy definitions declarative and colocated with their adapters.
- Run `pnpm lint` and `pnpm format` before submitting; Husky mirrors CI.

## Testing Guidelines
- Frameworks: Vitest for behavior; `tsd` or `expectTypeOf` for types.
- Coverage: `packages/core` ≥90%, tenant guard ≥95%, adapters ≥85%.
- Use snapshot fixtures for policy matrices.
- Conventions: co-locate tests (`*.spec.ts`, `*.test-d.ts`).

## Commit & Pull Request Guidelines
- Conventional Commits (e.g., `feat(core): …`, `fix(adapter-prisma): …`).
- Default branch: `master`; open PRs against `master`.
- Each commit must build and pass tests.
- PRs include a clear summary, linked issues, testing notes, and docs/Changeset when user-facing behavior changes. Add screenshots or CLI transcripts for devtools/tenant guard diagnostics. Request review from relevant maintainer; green CI required.

## Security & Configuration Tips
- Default to fail-closed policies; do not bypass tenant guard in examples.
- Validate Prisma schema updates: `pnpm prisma-tenant-guard check`.
- Document required env vars in `docs/security.md`; confirm RLS emitters flag unsafe paths.

## Agent-Specific Instructions
These guidelines apply repo-wide. Prefer minimal, focused changes that match existing style; do not fix unrelated issues. Validate locally with `pnpm typecheck` and `pnpm test` before proposing patches, and update docs/Changesets when behavior changes.

