---
title: CLI Commands
outline: deep
---

# CLI Commands

AuthzKit ships two CLIs that help you wire policies into your application workflows.

## `authzkit-tenant-guard`

Validate Prisma schemas, enforce tenant isolation, and generate deployment guidance.

### Install

::: code-group
```bash [pnpm]
pnpm add @authzkit/prisma-tenant-guard
pnpm add -D @authzkit/prisma-tenant-guard-generator
```

```bash [npm]
npm install @authzkit/prisma-tenant-guard
npm install --save-dev @authzkit/prisma-tenant-guard-generator
```

```bash [yarn]
yarn add @authzkit/prisma-tenant-guard
yarn add --dev @authzkit/prisma-tenant-guard-generator
```

```bash [bun]
bun add @authzkit/prisma-tenant-guard
bun add -d @authzkit/prisma-tenant-guard-generator
```
:::

### Commands

| Command | Description |
| --- | --- |
| `authzkit-tenant-guard check` | Validates metadata, tenant fields, and relation targets. Fails CI when cross-tenant writes are possible. |
| `authzkit-tenant-guard plan` | Prints a readable summary of tenant fields, composite selectors, and nested targets. |
| `authzkit-tenant-guard rls` | Outputs Postgres row-level security (RLS) guidance for the configured `rls.varName`. |
| `authzkit-tenant-guard smoke` | Executes a synthetic write to confirm cross-tenant mutations are rejected. |

### Configuration

Save a `tenant-guard.config.json` file at the root of your project:

```json
{
  "tenantId": "tenant-a",
  "mode": "strict",
  "metaFile": ".prisma/tenant-guard/meta.json",
  "rls": { "enabled": true, "varName": "app.tenant_id" }
}
```

Use `--config`, `--mode`, or `--tenant` flags to override values per environment. The CLI exits non-zero on validation errors, making it safe to run in CI pipelines.

## `authzkit-tenant-guard-gen`

Generate up-to-date metadata directly from your Prisma schema. Run it after each schema change or as part of your migration scripts.

::: code-group
```bash [pnpm]
pnpm exec authzkit-tenant-guard-gen \
  --schema prisma/schema.prisma \
  --out .prisma/tenant-guard/meta.ts \
  --emitJson
```

```bash [npm]
npm exec authzkit-tenant-guard-gen \
  --schema prisma/schema.prisma \
  --out .prisma/tenant-guard/meta.ts \
  --emitJson
```

```bash [yarn]
yarn authzkit-tenant-guard-gen \
  --schema prisma/schema.prisma \
  --out .prisma/tenant-guard/meta.ts \
  --emitJson
```

```bash [bun]
bunx authzkit-tenant-guard-gen \
  --schema prisma/schema.prisma \
  --out .prisma/tenant-guard/meta.ts \
  --emitJson
```
:::

Options:

- `--tenantField="tenantId,accountId"` – provide a comma-separated list of tenant field candidates.
- `--include Post,Comment` or `--exclude AuditLog` – scope the generator to specific models.
- `--jsonOutputPath` – customize where the generated `.json` metadata lives.

The runtime and CLI both consume the generated metadata, so keep the outputs checked into your repo.

