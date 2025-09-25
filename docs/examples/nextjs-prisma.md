---
title: Next.js + Prisma Example
outline: deep
---

# Next.js + Prisma Example

SSR‑safe UI guards with React plus policy‑compiled Prisma filters for multi‑tenant data.

::: info
Next.js is a React framework. Use `@authzkit/react` for UI guards in any React app (Next.js, Remix, Vite + React, CRA, Expo). This page focuses on server decisions and Prisma; see [React UI Guards](/guides/react-ui) to add client‑side guards.
:::

## Setup

1) Create a Next.js app (TypeScript):

::: code-group
```bash [pnpm]
pnpm create next-app@latest my-app --typescript
cd my-app
```
```bash [npm]
npm create next-app@latest my-app -- --typescript
cd my-app
```
```bash [yarn]
yarn create next-app my-app --typescript
cd my-app
```
```bash [bun]
bun create next-app@latest my-app --typescript
cd my-app
```
:::

2) Add Prisma and initialize:

::: code-group
```bash [pnpm]
pnpm add -D prisma
pnpm add @prisma/client
pnpm prisma init
```
```bash [npm]
npm install --save-dev prisma
npm install @prisma/client
npm exec prisma init
```
```bash [yarn]
yarn add -D prisma
yarn add @prisma/client
yarn prisma init
```
```bash [bun]
bun add -d prisma
bun add @prisma/client
bunx prisma init
```
:::

3) Install AuthzKit packages:

::: code-group
```bash [pnpm]
pnpm add @authzkit/core
pnpm add @authzkit/prisma-tenant-guard
```
```bash [npm]
npm install @authzkit/core
npm install @authzkit/prisma-tenant-guard
```
```bash [yarn]
yarn add @authzkit/core
yarn add @authzkit/prisma-tenant-guard
```
```bash [bun]
bun add @authzkit/core
bun add @authzkit/prisma-tenant-guard
```
:::

4) Attach Tenant Guard to the Prisma client:

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

5) Use decisions in a server component or route handler:

```tsx
// app/posts/page.tsx
import { definePolicy } from '@authzkit/core'
import { prisma } from '@/prisma/client'

// You need to define your policy first
const policy = definePolicy({
  rules: [
    // Your policy rules here
  ]
})

export default async function PostsPage() {
  const subject = { id: 'u1', tenantId: 't1', role: 'member' }
  const d = policy.checkDetailed('post.read', { subject, resource: { tenantId: 't1' } })

  if (!d.allow) return <p>Not authorized</p>

  const posts = await prisma.post.findMany({
    // Apply filtering based on decision attributes if needed
    where: d.attrs ? buildPrismaWhere(d.attrs) : {},
    // Apply field masking if readMask is provided
    select: d.readMask ? buildPrismaSelect(d.readMask) : undefined
  })
  return <pre>{JSON.stringify(posts, null, 2)}</pre>
}
```

## What to look for

- Tri‑state UI guard patterns that render safely with SSR hydration.
- Field masking and query filtering derived from decisions (`select`/`where`).
- Prisma Tenant Guard blocks unsafe paths and validates tenant isolation.

## Troubleshooting

When you change your Prisma schema, re‑generate and validate safety:

::: code-group
```bash [pnpm]
pnpm prisma generate
pnpm authzkit-tenant-guard check
```
```bash [npm]
npm exec prisma generate
npm exec authzkit-tenant-guard check
```
```bash [yarn]
yarn prisma generate
yarn authzkit-tenant-guard check
```
```bash [bun]
bunx prisma generate
bunx authzkit-tenant-guard check
```
:::
