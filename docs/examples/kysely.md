---
title: Kysely Example
outline: deep
---

# Kysely Example

Guard Kysely queries by compiling AuthzKit decisions into `where` and `select` fragments.

```ts
import { Kysely } from 'kysely'
// Note: @authzkit/adapter-kysely does not exist yet
// You need to implement your own query building helpers

export const db = new Kysely<DB>({/* ... */})

// You need to define your policy first
const policy = definePolicy({
  rules: [
    // Your policy rules here
  ]
})

const d = policy.checkDetailed('doc.read', { subject, resource: { tenantId } })

if (!d.allow) {
  throw new Error(d.reason || 'Access denied')
}

const docs = await db
  .selectFrom('doc')
  .select(d.readMask ? buildKyselySelect(d.readMask) : ['*'])
  .where(d.attrs ? buildKyselyWhere(d.attrs) : sql`1 = 1`)
  .execute()
```

