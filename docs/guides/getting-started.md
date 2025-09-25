---
title: Getting Started
outline: deep
---

# Getting Started

Follow these steps to add AuthzKit to a TypeScript application and ship your first policy-backed feature.

## 1. Install the packages

::: code-group
```bash [pnpm]
pnpm add @authzkit/core
pnpm add @authzkit/react # optional – React UI guards
pnpm add @authzkit/prisma-tenant-guard # optional – Prisma tenant isolation
```

```bash [npm]
npm install @authzkit/core
npm install @authzkit/react # optional – React UI guards
npm install @authzkit/prisma-tenant-guard # optional – Prisma tenant isolation
```

```bash [yarn]
yarn add @authzkit/core
yarn add @authzkit/react # optional – React UI guards
yarn add @authzkit/prisma-tenant-guard # optional – Prisma tenant isolation
```

```bash [bun]
bun add @authzkit/core
bun add @authzkit/react # optional – React UI guards
bun add @authzkit/prisma-tenant-guard # optional – Prisma tenant isolation
```
:::

Every package is ESM-first and ships TypeScript declarations. Pick the client that matches your workspace.

::: info
Naming note: `@authzkit/react` provides UI guards for any React‑based framework (Next.js, Remix, React Router, Vite + React, Expo). Next.js examples import from `@authzkit/react` because Next.js apps are React apps.
:::

## 2. Model actions and subjects

Define the inputs your policies care about with `defineActions`. Each action becomes a strongly typed contract for the rest of the toolkit.

```ts
import { action, defineActions, definePolicy } from '@authzkit/core';

const actions = defineActions({
  'post.update': action<{
    subject: {
      id: string;
      role: 'admin' | 'editor' | 'viewer';
      tenantId: string;
    };
    resource: {
      id: string;
      authorId: string;
      tenantId: string;
      status: 'draft' | 'published';
    };
    data: {
      title?: string;
      body?: string;
      published?: boolean;
    };
  }>(),
});

type AppActions = typeof actions;
```

## 3. Declare policies

Policies stay fully typed, return read/write masks, and can expose human-readable reasons.

```ts
const policy = definePolicy<AppActions>({
  rules: [
    {
      id: 'owner-can-edit',
      action: 'post.update',
      effect: 'allow',
      when: ({ subject, resource }) => subject.id === resource.authorId,
      writeMask: { title: true, body: true },
      reason: 'OWNER_REQUIRED',
    },
    {
      id: 'draft-only-editors',
      action: 'post.update',
      effect: 'deny',
      when: ({ subject, resource }) =>
        subject.role !== 'editor' && resource.status === 'published',
      reason: 'ROLE_INSUFFICIENT',
    },
  ],
});
```

Use `policy.check(subject, action, inputs)` to obtain allow/deny decisions, masks, and reason codes. The helpers in later guides take those results further.

## 4. Connect to your stack

- **Prisma or SQL:** use the [Tenant Guard](/tenant-guard/) and upcoming adapters to compile decisions into safe `where/select` constraints.
- **React apps:** wrap UI with `<Guard>` and reuse server decisions during hydration ([React UI Guards](./react-ui)).
- **API routes/RPC:** pass decisions into the [Policy Masks](./policy-masks) utilities to validate payloads before hitting the database.
