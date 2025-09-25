# Repository Guidelines

## Project Structure & Module Organization

AuthzKit ships as a pnpm workspace monorepo. Key folders:

- `packages/core` holds the type-safe policy engine and shared utilities.
- `packages/prisma-tenant-guard` contains the tenant guard extension, generator, CLI, and Zod helpers.
- `packages/adapters/*` provide Prisma, Drizzle, Kysely, Next.js, and RPC integrations.
- `docs/` and `stories/` house guides, reference snippets, and UI guard demos.
- `.changeset/` tracks release notes; `.github/` carries CI workflows and issue templates.

## Build, Test, and Development Commands

Install dependencies once with `pnpm install`.

```bash
pnpm build         # Compile all packages via tsup
pnpm dev           # Run package watchers + Vitest in parallel
pnpm lint          # ESLint + Prettier checks
pnpm test          # Vitest with coverage thresholds
pnpm typecheck     # Strict TypeScript validation
pnpm release       # Publish via Changesets (maintainers only)
```

Run commands from the repo root unless a package exposes a package-specific script.

## Coding Style & Naming Conventions

Use 2-space indentation, trailing commas, and ESM-first imports. Public APIs are TypeScript-first with `strict`, `noUncheckedIndexedAccess`, and `exactOptionalPropertyTypes` enabled. Prefer `camelCase` for variables/functions, `PascalCase` for types/components, and `kebab-case` package names. Keep policy definitions declarative and colocated with their adapters. Run `pnpm lint` and `pnpm format` before submitting; the Husky pre-commit hook mirrors CI linting.

## Testing Guidelines

Unit and type tests live beside source files (`*.spec.ts`, `*.test-d.ts`). Use Vitest for behaviour, `tsd` or `expectTypeOf` for type safety, and snapshot fixtures for policy matrices. Maintain ≥90% coverage in `packages/core`, ≥95% in tenant guard, and ≥85% for adapters. For integration checks.

## Commit & Pull Request Guidelines

Follow Conventional Commits (`feat(core):`, `fix(adapter-prisma):`, etc.). The default branch is `master`; open PRs against `master` unless otherwise coordinated. Each commit should compile and pass tests. PRs must include: a clear summary, linked issue (if any), testing notes, and updated docs or Changeset when user-facing behaviour changes. Add screenshots or CLI transcripts when touching devtools or tenant guard diagnostics. Request review from a maintainer who owns the affected package; green CI is required before merge.

## Security & Configuration Tips

Default to fail-closed policies; never bypass tenant guard in examples. Validate Prisma schema updates with the tenant guard CLI (`pnpm prisma-tenant-guard check`). When adding new adapters, document required environment variables under `docs/security.md` and confirm RLS emitters flag unsafe paths.
