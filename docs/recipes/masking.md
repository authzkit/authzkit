---
title: Masking & Redaction Strategies
outline: deep
---

# Masking & Redaction Strategies

Derive field selections from decisions to avoid over‑fetching and to hide sensitive fields.

```ts
// You need to define your policy first
const policy = definePolicy({
  rules: [
    // Your policy rules here
  ]
})

const d = policy.checkDetailed('user.read', { subject })

if (!d.allow) {
  throw new Error(d.reason || 'Access denied')
}

const users = await prisma.user.findMany({
  select: d.readMask ? buildPrismaSelect(d.readMask) : undefined
})
```

## Partial redaction in UI

```tsx
const d = policy.checkDetailed('user.read-email', { subject, resource: user })
return <span>{d.allow ? user.email : '••••@example.com'}</span>
```

