---
title: UI Guards Patterns (SSR-safe)
outline: deep
---

# UI Guards Patterns (SSR-safe)

Render optimistically on the server, hydrate safely on the client, and avoid flashes.

## Tri‑state guard

```tsx
// Guarded.tsx
export function Guarded({ decision, allow, deny, pending, isSSR }) {
  // Note: PolicyDecision doesn't have an 'ssr' property
  // You need to implement your own SSR state management
  if (isSSR) return pending
  return decision.allow ? allow : deny
}
```

```tsx
// usage
<Guarded
  decision={policy.checkDetailed('project.update', { subject, resource })}
  isSSR={typeof window === 'undefined'}
  allow={<EditProject />}
  deny={<ReadOnlyBanner />}
  pending={<Skeleton />}
/>
```

## Explain decisions

```tsx
const d = policy.checkDetailed('project.update', ctx)
console.log({
  allow: d.allow,
  reason: d.reason,
  effect: d.effect,
  matchedRule: d.matchedRule
}) // who, what, why
```

