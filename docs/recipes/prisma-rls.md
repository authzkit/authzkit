---
title: Postgres RLS with Tenant Guard
outline: deep
---

# Postgres RLS with Tenant Guard

Use the CLI to plan safe Row‑Level Security and validate Prisma changes.

## Plan policies

::: code-group
```bash [pnpm]
pnpm prisma-tenant-guard rls --plan
```
```bash [npm]
npm exec prisma-tenant-guard rls --plan
```
```bash [yarn]
yarn prisma-tenant-guard rls --plan
```
```bash [bun]
bunx prisma-tenant-guard rls --plan
```
:::

This generates RLS suggestions based on your models and tenant keys.

## Apply and check

1. Apply the generated SQL under a migration.
2. Validate:

::: code-group
```bash [pnpm]
pnpm prisma-tenant-guard check
```
```bash [npm]
npm exec prisma-tenant-guard check
```
```bash [yarn]
yarn prisma-tenant-guard check
```
```bash [bun]
bunx prisma-tenant-guard check
```
:::

## Enforce at runtime

All Prisma access goes through the Tenant Guard extension; unsafe paths throw. Pair with AuthzKit decisions to compile `where/select` for least‑privilege data access.
