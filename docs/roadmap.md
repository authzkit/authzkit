---
title: Roadmap
outline: deep
---

# Roadmap

AuthzKit focuses on type‑safe, explainable authorization that spans API, data, and UI. This roadmap highlights upcoming milestones and what's currently underway.

## Now

- Core polish: clearer policy authoring ergonomics and decision explainability.
- Tenant Guard hardening: stricter checks, better diagnostics, and safer Prisma paths.
- Documentation/site: Examples and Recipes build‑out; adapter quickstarts; improved landing.

## Next

- Adapters parity: Drizzle and Kysely integrations aligned with Prisma capabilities.
- UI experience: richer React guard helpers and examples (SSR‑safe patterns by default).
- CLI improvements: faster `check` runs, clearer output, better migration hints.

## Later

- Devtools: decision timeline overlay, rule profiling, policy coverage reports.
- RLS tooling: emitters and checks to streamline Postgres RLS adoption.
- Framework recipes: Next.js and RPC patterns with session/subject handling.

## Milestones

- Preview (0.x): core engine, masks/filters, React UI guard, Prisma Tenant Guard, docs site.
- Beta: adapter parity, examples gallery, CLI UX, stability hardening.
- RC: docs completeness, API surface review, performance passes, edge‑case tests.
- 1.0 GA: frozen public APIs, migration guide, long‑term support policy.

## How we plan & track

- Issues and Discussions on GitHub drive prioritization and feedback.
- Changesets document user‑facing changes and release notes.
- Example apps double as integration smoke tests during development.

If you have use cases or integrations you’d like prioritized, open an issue with details about your stack and constraints. This helps us plan the next milestones effectively.
