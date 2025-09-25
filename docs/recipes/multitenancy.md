---
title: Multitenancy Tips & Testing
outline: deep
---

# Multitenancy Tips & Testing

- Default to fail‑closed: require a tenant on all relevant decision contexts.
- Keep tenant keys first‑class (e.g., `tenantId` on resources) to simplify filters.
- Snapshot policy matrices for critical actions using Vitest snapshots.

## Example test

```ts
it('matrix: project.read', () => {
  const cases = [
    { subject: { role: 'owner', tenantId: 't1' }, resource: { tenantId: 't1' } },
    { subject: { role: 'member', tenantId: 't1' }, resource: { tenantId: 't2' } },
  ]
  expect(cases.map(c => policy.checkDetailed('project.read', c).allow)).toMatchSnapshot()
})
```

