# @authzkit/prisma-tenant-guard

Tenant guardrails for Prisma with assist/assert/strict enforcement, a metadata generator, and a zero‑dep CLI. Pair decisions from `@authzkit/core` with safe `where/select` fragments and hard tenant isolation.

## Install

```bash
pnpm add @authzkit/prisma-tenant-guard
pnpm add -D @authzkit/prisma-tenant-guard-generator
```

<details>
<summary>Other package managers</summary>

Runtime package:
- npm: `npm install @authzkit/prisma-tenant-guard`
- yarn: `yarn add @authzkit/prisma-tenant-guard`
- bun: `bun add @authzkit/prisma-tenant-guard`

Generator (dev dependency):
- npm: `npm install --save-dev @authzkit/prisma-tenant-guard-generator`
- yarn: `yarn add --dev @authzkit/prisma-tenant-guard-generator`
- bun: `bun add -d @authzkit/prisma-tenant-guard-generator`

</details>

## Usage

Attach the guard to your Prisma client and compile decisions to filters and masks.

```ts
// prisma/client.ts
import { PrismaClient } from '@prisma/client'
import { createTenantClient } from '@authzkit/prisma-tenant-guard'

export const prisma = createTenantClient(new PrismaClient(), {
  tenantId: 'your-tenant-id',
  meta: {
    // Your tenant meta configuration
  }
})
```

```ts
// route or service
import { definePolicy } from '@authzkit/core'
import { prisma } from './prisma/client'

// You need to define your policy first
const d = policy.checkDetailed('post.read', { subject, resource: { tenantId } })
const posts = await prisma.post.findMany({
  where: d.attrs || {},
  select: d.readMask ? buildSelectFromMask(d.readMask) : undefined,
})
// Note: You need to implement buildSelectFromMask helper yourself
```

## CLI + generator

Generate metadata after each Prisma schema change:

- pnpm: `pnpm exec authzkit-tenant-guard-gen --schema prisma/schema.prisma --out .prisma/tenant-guard/meta.ts --emitJson`
- npm: `npm exec authzkit-tenant-guard-gen --schema prisma/schema.prisma --out .prisma/tenant-guard/meta.ts --emitJson`
- yarn: `yarn authzkit-tenant-guard-gen --schema prisma/schema.prisma --out .prisma/tenant-guard/meta.ts --emitJson`
- bun: `bunx authzkit-tenant-guard-gen --schema prisma/schema.prisma --out .prisma/tenant-guard/meta.ts --emitJson`

Validate in CI:

- pnpm: `pnpm exec authzkit-tenant-guard check`
- npm: `npm exec authzkit-tenant-guard check`
- yarn: `yarn authzkit-tenant-guard check`
- bun: `bunx authzkit-tenant-guard check`

## Docs

- [Guide](https://authzkit.github.io/authzkit/docs/guides/tenant-guard)
- [RLS recipe](https://authzkit.github.io/authzkit/docs/recipes/prisma-rls)
- [CLI reference](https://authzkit.github.io/authzkit/docs/reference/cli)

