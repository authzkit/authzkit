---
title: Policy Masks
outline: deep
---

# Policy Masks

Policies in `@authzkit/core` emit read and write masks that keep adapters, UI, and validation in sync. Use them to prevent over-posting, redact fields, and give meaningful feedback to users.

## Mask-aware Zod helpers

```ts
import { maskWriteSchema, maskRefinement } from '@authzkit/core/zod';
import { updatePostSchema } from './schemas';

const allowed = maskWriteSchema(updatePostSchema, decision.writeMask).safeParse(input);
if (!allowed.success || Object.keys(allowed.data).length === 0) {
  throw new Error('No fields permitted for update');
}

const validated = updatePostSchema
  .passthrough()
  .superRefine(maskRefinement(decision.writeMask));
```

- `maskWriteSchema` derives a strict partial object respecting nested masks (including arrays).
- `maskRefinement` layers mask enforcement on an existing schema; keep `.passthrough()` enabled so the refinement can flag unsupported keys.

## Prisma client extensions

```ts
import { PrismaClient } from '@prisma/client';
import { withMaskedPrisma } from './prisma-extension';

const prisma = withMaskedPrisma(new PrismaClient());

const masked = prisma.post.applyWriteMask(decision, input);
if (!masked.ok) {
  throw new Error(masked.reason);
}

await prisma.post.update({
  where: { tenantId_id: { tenantId: decision.subject.tenantId, id: post.id } },
  data: masked.data,
});
```

`withMaskedPrisma` applies the mask-aware schema before hitting the database so writes fail fast when a field is denied.

## RPC and client payload filtering

```ts
const prepared = prepareUpdatePayload(formData, decision.writeMask);
if (!prepared.ok) {
  throw new Error(prepared.reason);
}

const result = await submitUpdatePostRequest({
  postId,
  payload: prepared.payload,
});
```

Run `prepareUpdatePayload` inside forms or RPC clients to trim payloads ahead of network calls. Combine it with the Prisma helper above so both the client and server enforce the same mask without duplicating logic.

## Related guides

- [Getting Started](./getting-started) to define your first policies.
- [React UI Guards](./react-ui) to hydrate UI with the same policy decisions.
- [Tenant Guard](./tenant-guard) when you need multi-tenant isolation.
