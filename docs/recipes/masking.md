---
title: Masking & Redaction Strategies
outline: deep
---

# Masking & Redaction Strategies

Derive field selections from decisions to avoid over‑fetching and to hide sensitive fields.

```ts
// You need to define your policy first
const policy = definePolicy({
  byAction: {
    'user.read': [ { id: 'default', effect: 'allow', when: () => true } ]
  }
})

const d = policy.checkDetailed('user.read', { subject })

if (!d.allow) {
  throw new Error(d.reason || 'Access denied')
}

const users = await prisma.user.findMany()
// Apply field masking in your response layer using d.readMask
```

## Partial redaction in UI

```tsx
const d = policy.checkDetailed('user.read-email', { subject, resource: user })
return <span>{d.allow ? user.email : '••••@example.com'}</span>
```
