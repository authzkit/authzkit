---
title: Drizzle Example
outline: deep
---

# Drizzle Example

Use AuthzKit decisions to generate Drizzle filter fragments and field masks.

```ts
// db.ts
import { drizzle } from 'drizzle-orm'
// Note: @authzkit/adapter-drizzle does not exist yet
// You need to implement your own query building helpers

export const db = drizzle(connection)

// usage
// You need to define your policy first
const policy = definePolicy({
  rules: [
    // Your policy rules here
  ]
})

const d = policy.checkDetailed('invoice.read', { subject, resource: { tenantId } })

if (!d.allow) {
  throw new Error(d.reason || 'Access denied')
}

const rows = await db
  .select(d.readMask ? buildDrizzleSelect(d.readMask) : {})
  .from(invoice)
  .where(d.attrs ? buildDrizzleWhere(d.attrs) : sql`1 = 1`)
```

See also: [Postgres RLS with Tenant Guard](/recipes/prisma-rls) for RLS notes applicable to any SQL adapter.
