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

// You need to define your policy first (group rules by action for best DX)
const policy = definePolicy({
  byAction: {
    'post.read': [
      { id: 'allow-members', effect: 'allow', when: ({ subject }) => subject?.role === 'member' }
    ]
  }
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
    where: d.attrs || {}
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
