# Quick Start

Get AuthzKit Tenant Guard running in your Prisma application in under 5 minutes.

::: tip Prerequisites
This guide assumes you've already [installed AuthzKit Tenant Guard](/tenant-guard/installation). If not, complete the installation first, then return here.
:::

## Overview

You'll add tenant protection in 3 simple steps:
1. **Add generator** to your Prisma schema
2. **Generate metadata**
3. **Wrap your Prisma client**

## Step 1: Add Generator to Prisma Schema

Add the AuthzKit generator to your `schema.prisma` file:

```prisma{3-5}
generator client {
  provider = "prisma-client-js"
}

generator tenantGuard {
  provider = "@authzkit/prisma-tenant-guard-generator"
}

model User {
  id       Int    @id @default(autoincrement())
  tenantId String
  email    String @unique
  name     String
  todos    Todo[]

  @@unique([tenantId, id], map: "tenantId_id")
}

model Todo {
  id          Int       @id @default(autoincrement())
  tenantId    String
  title       String
  description String?
  completed   Boolean   @default(false)
  authorId    Int
  author      User      @relation(fields: [authorId, tenantId], references: [id, tenantId])
  tags        TodoTag[]

  @@unique([tenantId, id], map: "tenantId_id")
}

model Tag {
  id       Int       @id @default(autoincrement())
  tenantId String
  name     String
  color    String
  todos    TodoTag[]

  @@unique([tenantId, id], map: "tenantId_id")
}

model TodoTag {
  tenantId String
  todoId   Int
  tagId    Int
  todo     Todo @relation(fields: [todoId, tenantId], references: [id, tenantId])
  tag      Tag  @relation(fields: [tagId, tenantId], references: [id, tenantId])

  @@id([tenantId, todoId, tagId])
}
```

## Step 2: Generate AuthzKit Metadata

Run Prisma generate to create the tenant guard metadata:

```bash
npx prisma generate
```

This creates the AuthzKit metadata files in `.prisma/tenant-guard/`:
- `meta.json` - Runtime metadata
- `meta.ts` - TypeScript definitions

## Step 3: Create Tenant Guard Helper

Create a helper file to configure AuthzKit (e.g., `src/tenant-guard.ts`):

```typescript
import type { PrismaClient } from '@prisma/client';
import {
  tenantGuardExtension,
  type CreateTenantClientOptions,
  type Mode,
  type TenantMeta,
} from '@authzkit/prisma-tenant-guard';

import tenantGuardMeta from '../.prisma/tenant-guard/meta.json' assert { type: 'json' };

export const tenantMeta: TenantMeta = tenantGuardMeta;

const defaultMode: Mode = (process.env.TENANT_GUARD_MODE as Mode) ?? 'assist';

const buildGuardOptions = (tenantId: string, mode: Mode): CreateTenantClientOptions => ({
  tenantId,
  mode,
  meta: tenantMeta,
  rls: {
    enabled: process.env.TENANT_GUARD_RLS === 'true',
    varName: process.env.TENANT_GUARD_VAR ?? 'authzkit.tenant_id',
  },
  onWarn: (warning) => {
    console.log(`🔧 AuthzKit ${warning.code}: ${warning.model}.${warning.operation} at ${warning.path}`);
  },
});

export const withTenantGuard = (
  prisma: PrismaClient,
  tenantId: string,
  mode: Mode = defaultMode,
) => {
  const options = buildGuardOptions(tenantId, mode);
  return prisma.$extends(tenantGuardExtension(options));
};

export type TenantPrismaClient = ReturnType<typeof withTenantGuard>;
```

## Step 4: Use in Your Application

Now you can use AuthzKit-protected Prisma operations:

### Express.js Example

```typescript
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { withTenantGuard } from './tenant-guard.js';

const app = express();
const prisma = new PrismaClient();

app.use(express.json());

// Middleware to extract tenant ID
app.use((req, res, next) => {
  const tenantId = req.headers['x-tenant-id'] as string;
  if (!tenantId) {
    return res.status(400).json({ error: 'Missing x-tenant-id header' });
  }
  req.tenantId = tenantId;
  next();
});

// Create a todo with automatic tenant protection
app.post('/todos', async (req, res) => {
  try {
    const tenantDb = withTenantGuard(prisma, req.tenantId);
    const { title, authorId, tagIds } = req.body;

    const todo = await tenantDb.todo.create({
      data: {
        title,
        authorId,
        tags: {
          create: tagIds?.map((tagId: number) => ({
            tagId, // ✅ AuthzKit automatically validates tenant boundary
          })) || [],
        },
      },
      include: {
        author: true,
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });

    res.json(todo);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create todo' });
  }
});

app.listen(3000);
```

### Next.js API Route Example

```typescript
// pages/api/todos.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { withTenantGuard } from '../../lib/tenant-guard';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const tenantId = req.headers['x-tenant-id'] as string;
  if (!tenantId) {
    return res.status(400).json({ error: 'Missing tenant ID' });
  }

  try {
    const tenantDb = withTenantGuard(prisma, tenantId);
    const { title, authorId, tags } = req.body;

    const todo = await tenantDb.todo.create({
      data: {
        title,
        authorId,
        tags: {
          connect: tags?.map((tag: { id: number }) => ({ id: tag.id })) || [],
          // ✅ AuthzKit automatically prevents cross-tenant tag connections
        },
      },
      include: {
        author: true,
        tags: { include: { tag: true } },
      },
    });

    res.json(todo);
  } catch (error) {
    console.error('Error creating todo:', error);
    res.status(500).json({ error: 'Failed to create todo' });
  }
}
```

## Step 5: Test the Protection

Try making a cross-tenant operation to verify AuthzKit is working:

```bash
# Create a todo in tenant-1
curl -X POST -H "x-tenant-id: tenant-1" \
  -H "Content-Type: application/json" \
  -d '{"title": "My Todo", "authorId": 1}' \
  http://localhost:3000/todos

# Try to connect a tag from tenant-2 (this will be blocked)
curl -X PUT -H "x-tenant-id: tenant-1" \
  -H "Content-Type: application/json" \
  -d '{"tags": {"connect": [{"id": 999}]}}' \
  http://localhost:3000/todos/1
```

If AuthzKit is working correctly, the second request will fail with a tenant violation error.

## Configuration Options

### Environment Variables

```bash
# Set AuthzKit mode (assist, strict, assert)
TENANT_GUARD_MODE=assist

# Enable Postgres RLS integration
TENANT_GUARD_RLS=true
TENANT_GUARD_VAR=authzkit.tenant_id
```

### AuthzKit Modes

- **`assist`** (recommended for development): Auto-injects missing tenant fields with warnings
- **`strict`** (recommended for production): Throws errors on missing tenant fields
- **`assert`** (experimental): Advanced validation mode

## What's Next?

🎉 **Congratulations!** AuthzKit Tenant Guard is now protecting your application from cross-tenant security violations.

### Next Steps:

1. **[Learn How It Works](/tenant-guard/concepts)** - Understand how AuthzKit works under the hood
2. **[Security Testing](/tenant-guard/security-testing)** - Test AuthzKit protection in your specific use case
3. **[Configuration](/tenant-guard/configuration)** - Advanced configuration options
4. **[Best Practices](/tenant-guard/best-practices)** - Production deployment recommendations

### Verification Checklist:

- ✅ AuthzKit generator added to Prisma schema
- ✅ Metadata files generated in `.prisma/tenant-guard/`
- ✅ Tenant guard helper created and configured
- ✅ Application using `withTenantGuard()` for database operations
- ✅ Cross-tenant operations are being blocked
- ✅ Legitimate same-tenant operations work correctly

---

**You're now protected against cross-tenant security violations by construction!**