# @authzkit/core

Type‑safe, framework‑agnostic policy engine for modern TypeScript apps. Define actions once and reuse decisions across API, data, and UI layers.

## Install

`pnpm add @authzkit/core`

<details>
<summary>Other package managers</summary>

- npm: `npm install @authzkit/core`
- yarn: `yarn add @authzkit/core`
- bun: `bun add @authzkit/core`

</details>

## Quick start

Model your actions and declare policies with full type inference. Compile decisions into masks for UI/API, and `where/select` fragments via adapters.

```ts
import { action, defineActions, definePolicy } from '@authzkit/core';

const actions = defineActions({
  'post.update': action<{
    subject: { id: string; role: 'admin' | 'editor'; tenantId: string };
    resource: { id: string; authorId: string; tenantId: string; status: 'draft' | 'published' };
    data: { title?: string; body?: string; published?: boolean };
  }>(),
});

const policy = definePolicy<typeof actions>({
  byAction: {
    'post.update': [
      {
        id: 'owner-can-edit',
        effect: 'allow',
        when: ({ subject, resource }) => subject.id === resource.authorId,
        writeMask: { title: true, body: true },
      },
      {
        id: 'no-edit-published',
        effect: 'deny',
        when: ({ resource }) => resource.status === 'published',
      },
    ],
  },
});

// Evaluate once and reuse everywhere
const d = policy.checkDetailed('post.update', {
  subject: { id: 'u1', role: 'editor', tenantId: 't1' },
  resource: { id: 'p1', authorId: 'u1', tenantId: 't1', status: 'draft' },
  data: { title: 'Hello' },
});

if (d.allow) {
  // UI/API masks
  d.writeMask; // -> { title: true, body: true }
}
```

## Docs

- [Getting started](https://authzkit.github.io/authzkit/docs/guides/getting-started)
- [Policy masks](https://authzkit.github.io/authzkit/docs/guides/policy-masks)
- [React UI guards](https://authzkit.github.io/authzkit/docs/guides/react-ui)
