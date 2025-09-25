---
title: Prisma Minimal Example
outline: deep
---

# Prisma Minimal Example

A quick look at using AuthzKit with Prisma and the Tenant Guard extension to compile decisions into filters and masks.

## Install and scaffold

::: code-group
```bash [pnpm]
pnpm add -D prisma
pnpm add @prisma/client
pnpm add @authzkit/prisma-tenant-guard
pnpm prisma init
```
```bash [npm]
npm install --save-dev prisma
npm install @prisma/client
npm install @authzkit/prisma-tenant-guard
npm exec prisma init
```
```bash [yarn]
yarn add -D prisma
yarn add @prisma/client
yarn add @authzkit/prisma-tenant-guard
yarn prisma init
```
```bash [bun]
bun add -d prisma
bun add @prisma/client
bun add @authzkit/prisma-tenant-guard
bunx prisma init
```
:::

## Attach Tenant Guard

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

## Compile decisions to filters

```ts
// app.ts
import { prisma } from './prisma/client'
import { definePolicy } from '@authzkit/core'

// You need to define your policy first
const policy = definePolicy({
  byAction: {
    'post.read': [
      { id: 'allow-members', effect: 'allow', when: ({ subject }) => subject?.role === 'member' }
    ]
  }
})

const decision = policy.checkDetailed('post.read', { subject, resource: { tenantId } })

if (!decision.allow) {
  throw new Error(decision.reason || 'Access denied')
}

const posts = await prisma.post.findMany({
  // Apply filtering based on decision attributes if needed
  where: decision.attrs || {}
})
// Apply field masking in your response layer using decision.readMask (no ORM helper is provided)
```

Validate schema & paths:

::: code-group
```bash [pnpm]
pnpm exec authzkit-tenant-guard check
```
```bash [npm]
npm exec authzkit-tenant-guard check
```
```bash [yarn]
yarn authzkit-tenant-guard check
```
```bash [bun]
bunx authzkit-tenant-guard check
```
:::
