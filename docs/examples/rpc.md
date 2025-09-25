---
title: RPC / API Route Example
outline: deep
---

# RPC / API Route Example

Protect RPC endpoints with AuthzKit decisions and return explainable results.

```ts
// api/posts.get.ts
import { definePolicy } from '@authzkit/core'
import { prisma } from '../prisma/client'

// You need to define your policy first
const policy = definePolicy({
  rules: [
    // Your policy rules here
  ]
})

export async function handler(ctx) {
  const subject = ctx.auth.user
  const d = policy.checkDetailed('post.read', { subject })
  if (!d.allow) return ctx.res.status(403).json({
    error: d.reason || 'Access denied',
    effect: d.effect
  })

  const data = await prisma.post.findMany({
    // Apply filtering based on decision attributes if needed
    where: d.attrs ? buildPrismaWhere(d.attrs) : {},
    // Apply field masking if readMask is provided
    select: d.readMask ? buildPrismaSelect(d.readMask) : undefined
  })
  return ctx.res.json({
    data,
    decision: {
      allow: d.allow,
      reason: d.reason,
      effect: d.effect
    }
  })
}
```

