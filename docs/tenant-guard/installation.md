# Installation

Detailed installation guide for AuthzKit Tenant Guard with different frameworks and deployment scenarios.

## Requirements

- **Node.js**: 18.0.0 or higher
- **Prisma**: 5.0.0 or higher
- **TypeScript**: 4.8.0 or higher (recommended)

## Package Installation

::: code-group
```bash [pnpm]
pnpm add @authzkit/prisma-tenant-guard
```

```bash [npm]
npm install @authzkit/prisma-tenant-guard
```

```bash [yarn]
yarn add @authzkit/prisma-tenant-guard
```

```bash [bun]
bun add @authzkit/prisma-tenant-guard
```
:::

## Prisma Schema Setup

### 1. Add the Generator

Add the AuthzKit Tenant Guard generator to your `schema.prisma` file:

```prisma
generator client {
  provider = "prisma-client-js"
}

generator tenantGuard {
  provider = "@authzkit/prisma-tenant-guard-generator"
}
```

### 2. Multi-tenant Schema Design

Your Prisma schema must follow multi-tenant patterns with `tenantId` fields and composite unique constraints:

```prisma
model User {
  id       Int    @id @default(autoincrement())
  tenantId String // Required: tenant isolation field
  email    String
  name     String
  posts    Post[]

  // Required: Composite unique constraint for tenant isolation
  @@unique([tenantId, id], map: "tenantId_id")
}

model Post {
  id       Int    @id @default(autoincrement())
  tenantId String // Required: tenant isolation field
  title    String
  content  String
  authorId Int

  // Required: Tenant-aware foreign key
  author User @relation(fields: [authorId, tenantId], references: [id, tenantId])

  // Required: Composite unique constraint
  @@unique([tenantId, id], map: "tenantId_id")
}
```

### 3. Generate Metadata

Run Prisma generate to create AuthzKit metadata:

::: code-group
```bash [pnpm]
pnpm prisma generate
```

```bash [npm]
npx prisma generate
```

```bash [yarn]
yarn prisma generate
```

```bash [bun]
bun prisma generate
```
:::

This creates the following files:
- `.prisma/tenant-guard/meta.json` - Runtime metadata
- `.prisma/tenant-guard/meta.ts` - TypeScript definitions

## Framework Integration

### Express.js

Create a tenant guard helper (`src/lib/tenant-guard.ts`):

```typescript
import type { PrismaClient } from '@prisma/client';
import {
  tenantGuardExtension,
  type CreateTenantClientOptions,
  type Mode,
  type TenantMeta,
} from '@authzkit/prisma-tenant-guard';

import tenantGuardMeta from '../../.prisma/tenant-guard/meta.json' assert { type: 'json' };

export const tenantMeta: TenantMeta = tenantGuardMeta;

export const withTenantGuard = (
  prisma: PrismaClient,
  tenantId: string,
  mode: Mode = 'assist'
) => {
  const options: CreateTenantClientOptions = {
    tenantId,
    mode,
    meta: tenantMeta,
    onWarn: (warning) => {
      console.warn(`🔧 AuthzKit ${warning.code}: ${warning.model}.${warning.operation} at ${warning.path}`);
    },
  };

  return prisma.$extends(tenantGuardExtension(options));
};
```

Use in your Express routes:

```typescript
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { withTenantGuard } from './lib/tenant-guard';

const app = express();
const prisma = new PrismaClient();

app.use((req, res, next) => {
  const tenantId = req.headers['x-tenant-id'] as string;
  if (!tenantId) {
    return res.status(400).json({ error: 'Missing tenant ID' });
  }
  req.tenantDb = withTenantGuard(prisma, tenantId);
  next();
});

app.get('/users', async (req, res) => {
  const users = await req.tenantDb.user.findMany();
  res.json(users);
});
```

### Next.js

#### App Router (app/)

Create a tenant guard utility (`lib/tenant-guard.ts`):

```typescript
import { PrismaClient } from '@prisma/client';
import { withTenantGuard as _withTenantGuard } from '@authzkit/prisma-tenant-guard';
import tenantMeta from '../.prisma/tenant-guard/meta.json';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export const withTenantGuard = (tenantId: string) => {
  return _withTenantGuard(prisma, tenantId, {
    meta: tenantMeta,
    mode: process.env.NODE_ENV === 'production' ? 'strict' : 'assist',
  });
};
```

Use in API routes (`app/api/users/route.ts`):

```typescript
import { NextRequest } from 'next/server';
import { withTenantGuard } from '@/lib/tenant-guard';

export async function GET(request: NextRequest) {
  const tenantId = request.headers.get('x-tenant-id');

  if (!tenantId) {
    return Response.json({ error: 'Missing tenant ID' }, { status: 400 });
  }

  try {
    const tenantDb = withTenantGuard(tenantId);
    const users = await tenantDb.user.findMany();
    return Response.json(users);
  } catch (error) {
    return Response.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}
```

#### Pages Router (pages/)

Use in API routes (`pages/api/users.ts`):

```typescript
import type { NextApiRequest, NextApiResponse } from 'next';
import { withTenantGuard } from '../../lib/tenant-guard';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const tenantId = req.headers['x-tenant-id'] as string;

  if (!tenantId) {
    return res.status(400).json({ error: 'Missing tenant ID' });
  }

  const tenantDb = withTenantGuard(tenantId);

  if (req.method === 'GET') {
    const users = await tenantDb.user.findMany();
    res.json(users);
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
```

### Fastify

```typescript
import Fastify from 'fastify';
import { PrismaClient } from '@prisma/client';
import { withTenantGuard } from './lib/tenant-guard';

const fastify = Fastify();
const prisma = new PrismaClient();

// Tenant middleware
fastify.addHook('preHandler', async (request, reply) => {
  const tenantId = request.headers['x-tenant-id'] as string;

  if (!tenantId) {
    throw new Error('Missing tenant ID');
  }

  request.tenantDb = withTenantGuard(prisma, tenantId);
});

fastify.get('/users', async (request, reply) => {
  const users = await request.tenantDb.user.findMany();
  return users;
});
```

### tRPC

```typescript
import { initTRPC } from '@trpc/server';
import { PrismaClient } from '@prisma/client';
import { withTenantGuard } from './tenant-guard';

const prisma = new PrismaClient();

const t = initTRPC.context<{ tenantId: string }>().create();

const tenantProcedure = t.procedure.use(({ ctx, next }) => {
  const tenantDb = withTenantGuard(prisma, ctx.tenantId);
  return next({ ctx: { ...ctx, tenantDb } });
});

export const appRouter = t.router({
  getUsers: tenantProcedure.query(({ ctx }) => {
    return ctx.tenantDb.user.findMany();
  }),
});
```

## Database Setup

### PostgreSQL with RLS (Recommended)

AuthzKit can integrate with PostgreSQL Row-Level Security for defense in depth:

```sql
-- Enable RLS on your tables
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Post" ENABLE ROW LEVEL SECURITY;

-- Create policies that respect the AuthzKit tenant variable
CREATE POLICY "tenant_isolation_user" ON "User"
  USING (current_setting('authzkit.tenant_id', true) = "tenantId");

CREATE POLICY "tenant_isolation_post" ON "Post"
  USING (current_setting('authzkit.tenant_id', true) = "tenantId");
```

Enable RLS integration in your AuthzKit configuration:

```typescript
export const withTenantGuard = (prisma: PrismaClient, tenantId: string) => {
  return prisma.$extends(tenantGuardExtension({
    tenantId,
    meta: tenantMeta,
    rls: {
      enabled: true,
      varName: 'authzkit.tenant_id',
    },
  }));
};
```

### SQLite

SQLite works out of the box with AuthzKit. No additional setup required.

### MySQL

MySQL works with AuthzKit using foreign key constraints for tenant isolation.

## Environment Configuration

Create a `.env` file with AuthzKit configuration:

```bash
# AuthzKit Tenant Guard Configuration
TENANT_GUARD_MODE=assist          # assist|strict|assert
TENANT_GUARD_RLS=false           # Enable PostgreSQL RLS integration
TENANT_GUARD_VAR=authzkit.tenant_id # RLS variable name
```

## TypeScript Configuration

Ensure your `tsconfig.json` supports the import assertions for JSON metadata:

```json
{
  "compilerOptions": {
    "moduleResolution": "node",
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "resolveJsonModule": true
  }
}
```

For older TypeScript versions, you may need to use dynamic imports:

```typescript
// Alternative import method for older TypeScript
const tenantMeta = await import('../.prisma/tenant-guard/meta.json');
```

## Deployment Considerations

### Build Process

Ensure the AuthzKit metadata is generated during your build process:

::: code-group
```json [pnpm]
{
  "scripts": {
    "build": "prisma generate && next build",
    "deploy": "prisma generate && pnpm run build"
  }
}
```

```json [npm]
{
  "scripts": {
    "build": "prisma generate && next build",
    "deploy": "prisma generate && npm run build"
  }
}
```

```json [yarn]
{
  "scripts": {
    "build": "prisma generate && next build",
    "deploy": "prisma generate && yarn run build"
  }
}
```
:::

### Docker

Include Prisma generation in your Dockerfile:

::: code-group
```dockerfile [pnpm]
FROM node:18-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/

RUN corepack enable pnpm && pnpm install --frozen-lockfile

COPY . .

# Generate Prisma client and AuthzKit metadata
RUN pnpm prisma generate

RUN pnpm run build

CMD ["pnpm", "start"]
```

```dockerfile [npm]
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

COPY . .

# Generate Prisma client and AuthzKit metadata
RUN npx prisma generate

RUN npm run build

CMD ["npm", "start"]
```

```dockerfile [yarn]
FROM node:18-alpine

WORKDIR /app

COPY package.json yarn.lock ./
COPY prisma ./prisma/

RUN yarn install --frozen-lockfile

COPY . .

# Generate Prisma client and AuthzKit metadata
RUN yarn prisma generate

RUN yarn run build

CMD ["yarn", "start"]
```
:::

### Serverless Deployments

For serverless deployments (Vercel, Netlify, AWS Lambda):

1. Ensure `prisma generate` runs during build
2. Include `.prisma/` directory in your deployment
3. Consider using connection pooling for database connections

::: code-group
```json [pnpm]
// vercel.json
{
  "buildCommand": "prisma generate && pnpm run build"
}
```

```json [npm]
// vercel.json
{
  "buildCommand": "prisma generate && npm run build"
}
```

```json [yarn]
// vercel.json
{
  "buildCommand": "prisma generate && yarn run build"
}
```
:::

## Verification

After installation, verify AuthzKit is working:

1. **Check metadata generation**:
   ```bash
   ls -la .prisma/tenant-guard/
   # Should show meta.json and meta.ts files
   ```

2. **Test tenant isolation**:
   ```typescript
   const tenantDb = withTenantGuard(prisma, 'tenant-1');

   // This should work
   await tenantDb.user.findMany();

   // This should be blocked if using cross-tenant IDs
   await tenantDb.post.create({
     data: {
       title: 'Test',
       authorId: crossTenantUserId, // Will be blocked
     }
   });
   ```

3. **Check AuthzKit warnings** in your application logs for auto-injection notifications.

## Troubleshooting

### Common Issues

**Metadata not generated**:
- Ensure the generator is in your `schema.prisma`
- Run `npx prisma generate` explicitly
- Check that the package is installed correctly

**TypeScript import errors**:
- Verify `resolveJsonModule: true` in `tsconfig.json`
- Try dynamic import for older TypeScript versions

**Runtime errors**:
- Ensure tenant ID is provided to `withTenantGuard()`
- Check that your schema follows multi-tenant patterns
- Verify foreign key relationships include `tenantId`

See [Troubleshooting Guide](/tenant-guard/troubleshooting) for more solutions.

---

**Next: [Quick Start](/tenant-guard/quick-start)** - Get AuthzKit running in your application in under 5 minutes.