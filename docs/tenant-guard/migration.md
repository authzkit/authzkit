# Migration Guide

Step-by-step guide for migrating existing multi-tenant applications to AuthzKit Tenant Guard.

## Migration Overview

Migrating to AuthzKit involves three main phases:
1. **Schema preparation** - Ensure your schema follows multi-tenant patterns
2. **AuthzKit integration** - Add the generator and create tenant clients
3. **Code migration** - Replace manual validation with AuthzKit protection

## Phase 1: Schema Assessment and Preparation

### Assess Current Schema

First, evaluate your existing schema for AuthzKit compatibility:

```typescript
// Assessment checklist
const schemaAssessment = {
  tenantFields: 'Do all models have tenant identification fields?',
  compositeKeys: 'Do models have composite unique constraints with tenant fields?',
  relationships: 'Do foreign keys include tenant fields?',
  junctionTables: 'Do many-to-many junction tables include tenant fields?',
  naming: 'Is tenant field naming consistent across models?'
};
```

### Current Schema Patterns

#### ❌ Non-tenant-aware Schema (Needs Migration)

```prisma
// Before: Single-tenant or non-tenant-aware
model User {
  id    Int    @id @default(autoincrement())
  email String @unique
  posts Post[]
}

model Post {
  id       Int    @id @default(autoincrement())
  title    String
  authorId Int
  author   User   @relation(fields: [authorId], references: [id])
}
```

#### ✅ Tenant-aware Schema (AuthzKit Ready)

```prisma
// After: Multi-tenant with AuthzKit support
model User {
  id       Int    @id @default(autoincrement())
  tenantId String
  email    String
  posts    Post[]

  @@unique([tenantId, id], map: "tenantId_id")
  @@unique([tenantId, email], map: "tenantId_email")
}

model Post {
  id       Int    @id @default(autoincrement())
  tenantId String
  title    String
  authorId Int
  author   User   @relation(fields: [authorId, tenantId], references: [id, tenantId])

  @@unique([tenantId, id], map: "tenantId_id")
}
```

### Schema Migration Steps

#### Step 1: Add Tenant Fields

```sql
-- Add tenantId to existing tables
ALTER TABLE "User" ADD COLUMN "tenantId" VARCHAR(255);
ALTER TABLE "Post" ADD COLUMN "tenantId" VARCHAR(255);

-- Update existing data with appropriate tenant IDs
UPDATE "User" SET "tenantId" = 'default-tenant' WHERE "tenantId" IS NULL;
UPDATE "Post" SET "tenantId" = 'default-tenant' WHERE "tenantId" IS NULL;

-- Make tenantId non-nullable
ALTER TABLE "User" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Post" ALTER COLUMN "tenantId" SET NOT NULL;
```

#### Step 2: Add Composite Constraints

```sql
-- Create composite unique constraints
ALTER TABLE "User" ADD CONSTRAINT "tenantId_id" UNIQUE ("tenantId", "id");
ALTER TABLE "User" ADD CONSTRAINT "tenantId_email" UNIQUE ("tenantId", "email");
ALTER TABLE "Post" ADD CONSTRAINT "tenantId_id" UNIQUE ("tenantId", "id");
```

#### Step 3: Update Foreign Keys

```sql
-- Drop existing foreign keys
ALTER TABLE "Post" DROP CONSTRAINT "Post_authorId_fkey";

-- Add tenant-aware foreign keys
ALTER TABLE "Post" ADD CONSTRAINT "Post_authorId_tenantId_fkey"
  FOREIGN KEY ("authorId", "tenantId") REFERENCES "User"("id", "tenantId");
```

#### Step 4: Update Prisma Schema

```prisma
// Update your schema.prisma to match the database changes
model User {
  id       Int    @id @default(autoincrement())
  tenantId String
  email    String
  posts    Post[]

  @@unique([tenantId, id], map: "tenantId_id")
  @@unique([tenantId, email], map: "tenantId_email")
}

model Post {
  id       Int    @id @default(autoincrement())
  tenantId String
  title    String
  authorId Int
  author   User   @relation(fields: [authorId, tenantId], references: [id, tenantId])

  @@unique([tenantId, id], map: "tenantId_id")
}
```

## Phase 2: AuthzKit Integration

### Step 1: Install AuthzKit

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

### Step 2: Add Generator

```prisma
generator client {
  provider = "prisma-client-js"
}

generator tenantGuard {
  provider = "@authzkit/prisma-tenant-guard-generator"
}
```

### Step 3: Generate Metadata

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

Verify metadata generation:
```bash
ls -la .prisma/tenant-guard/
# Should show meta.json and meta.ts files
```

### Step 4: Create Tenant Guard Helper

```typescript
// lib/tenant-guard.ts
import type { PrismaClient } from '@prisma/client';
import {
  tenantGuardExtension,
  type CreateTenantClientOptions,
  type Mode,
  type TenantMeta,
} from '@authzkit/prisma-tenant-guard';

import tenantGuardMeta from '../.prisma/tenant-guard/meta.json' assert { type: 'json' };

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
      console.log(`🔧 AuthzKit ${warning.code}: ${warning.model}.${warning.operation} at ${warning.path}`);
    },
  };

  return prisma.$extends(tenantGuardExtension(options));
};

export type TenantPrismaClient = ReturnType<typeof withTenantGuard>;
```

## Phase 3: Code Migration

### Step 1: Identify Current Validation Code

Find and catalog existing tenant validation:

```typescript
// Example: Existing manual validation
const getCurrentUserPosts = async (userId: number, tenantId: string) => {
  // Manual tenant validation
  const user = await prisma.user.findFirst({
    where: { id: userId, tenantId }
  });

  if (!user) {
    throw new Error('User not found or access denied');
  }

  const posts = await prisma.post.findMany({
    where: { authorId: userId, tenantId } // Manual tenant filtering
  });

  return posts;
};
```

### Step 2: Replace with AuthzKit Protection

```typescript
// After: AuthzKit automatic protection
const getCurrentUserPosts = async (userId: number, tenantId: string) => {
  const tenantDb = withTenantGuard(prisma, tenantId);

  // AuthzKit automatically validates tenant access
  const user = await tenantDb.user.findUnique({
    where: { id: userId } // tenantId automatically injected
  });

  if (!user) {
    throw new Error('User not found');
  }

  const posts = await tenantDb.post.findMany({
    where: { authorId: userId } // tenantId automatically injected
  });

  return posts;
};
```

### Step 3: Migration Strategy by Layer

#### Repository Layer Migration

```typescript
// Before: Manual validation in repositories
class UserRepository {
  async findById(id: number, tenantId: string) {
    return prisma.user.findFirst({
      where: { id, tenantId } // Manual tenant filtering
    });
  }

  async create(userData: CreateUserData, tenantId: string) {
    return prisma.user.create({
      data: { ...userData, tenantId } // Manual tenant injection
    });
  }
}

// After: AuthzKit automatic protection
class UserRepository {
  constructor(private tenantDb: TenantPrismaClient) {}

  async findById(id: number) {
    return this.tenantDb.user.findUnique({
      where: { id } // tenantId automatically handled
    });
  }

  async create(userData: CreateUserData) {
    return this.tenantDb.user.create({
      data: userData // tenantId automatically injected
    });
  }
}
```

#### Service Layer Migration

```typescript
// Before: Tenant validation scattered throughout services
class PostService {
  async createPost(postData: CreatePostData, authorId: number, tenantId: string) {
    // Manual validation
    const author = await prisma.user.findFirst({
      where: { id: authorId, tenantId }
    });

    if (!author) {
      throw new Error('Author not found or access denied');
    }

    return prisma.post.create({
      data: { ...postData, authorId, tenantId }
    });
  }

  async addTagsToPost(postId: number, tagIds: number[], tenantId: string) {
    // Manual validation for each tag
    const tags = await prisma.tag.findMany({
      where: { id: { in: tagIds }, tenantId }
    });

    if (tags.length !== tagIds.length) {
      throw new Error('Some tags not found or access denied');
    }

    // Manual tenant validation for post
    const post = await prisma.post.findFirst({
      where: { id: postId, tenantId }
    });

    if (!post) {
      throw new Error('Post not found or access denied');
    }

    // Create associations with manual tenant injection
    return prisma.postTag.createMany({
      data: tagIds.map(tagId => ({ postId, tagId, tenantId }))
    });
  }
}

// After: AuthzKit handles all validation automatically
class PostService {
  constructor(private tenantDb: TenantPrismaClient) {}

  async createPost(postData: CreatePostData, authorId: number) {
    // AuthzKit automatically validates author belongs to tenant
    return this.tenantDb.post.create({
      data: { ...postData, authorId }
    });
  }

  async addTagsToPost(postId: number, tagIds: number[]) {
    // AuthzKit automatically validates post and tags belong to tenant
    return this.tenantDb.post.update({
      where: { id: postId },
      data: {
        tags: {
          connect: tagIds.map(id => ({ id }))
        }
      }
    });
  }
}
```

#### API Layer Migration

```typescript
// Before: Manual tenant extraction and validation
app.get('/api/posts', async (req, res) => {
  const tenantId = req.headers['x-tenant-id'] as string;

  if (!tenantId) {
    return res.status(400).json({ error: 'Missing tenant ID' });
  }

  try {
    const posts = await prisma.post.findMany({
      where: { tenantId }, // Manual filtering
      include: {
        author: {
          where: { tenantId } // Manual filtering in includes
        },
        tags: {
          where: { tenantId } // Manual filtering in nested relations
        }
      }
    });

    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

// After: AuthzKit automatic protection
app.get('/api/posts', async (req, res) => {
  const tenantId = req.headers['x-tenant-id'] as string;

  if (!tenantId) {
    return res.status(400).json({ error: 'Missing tenant ID' });
  }

  try {
    const tenantDb = withTenantGuard(prisma, tenantId);

    // AuthzKit automatically filters all relations by tenant
    const posts = await tenantDb.post.findMany({
      include: {
        author: true, // Automatically tenant-filtered
        tags: true    // Automatically tenant-filtered
      }
    });

    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});
```

## Migration Testing Strategy

### Step 1: Dual Implementation Testing

Run both old and new implementations in parallel to verify equivalence:

```typescript
// Test helper to compare implementations
const compareImplementations = async (tenantId: string, operation: () => Promise<any>) => {
  // Old implementation result
  const oldResult = await operation();

  // New implementation with AuthzKit
  const tenantDb = withTenantGuard(prisma, tenantId);
  const newResult = await operation(); // Same operation with AuthzKit

  // Compare results
  expect(newResult).toEqual(oldResult);
};

// Test specific operations
describe('Migration Validation', () => {
  it('should produce equivalent results for user queries', async () => {
    await compareImplementations('tenant-1', async () => {
      return await getUserPosts(userId, 'tenant-1');
    });
  });
});
```

### Step 2: Security Validation

Verify that AuthzKit blocks operations that manual validation would catch:

```typescript
describe('Security Validation', () => {
  it('should block cross-tenant access attempts', async () => {
    const tenant1Db = withTenantGuard(prisma, 'tenant-1');
    const tenant2Db = withTenantGuard(prisma, 'tenant-2');

    // Create post in tenant-1
    const post = await tenant1Db.post.create({
      data: { title: 'Tenant 1 Post', authorId: 1 }
    });

    // Try to access from tenant-2 (should fail)
    const crossTenantAccess = await tenant2Db.post.findUnique({
      where: { id: post.id }
    });

    expect(crossTenantAccess).toBeNull();
  });
});
```

### Step 3: Performance Comparison

Measure performance impact of AuthzKit vs manual validation:

```typescript
import { performance } from 'perf_hooks';

const benchmarkMigration = async () => {
  const iterations = 1000;

  // Benchmark manual validation
  const manualStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    await manualGetUserPosts(userId, tenantId);
  }
  const manualTime = performance.now() - manualStart;

  // Benchmark AuthzKit
  const authzKitStart = performance.now();
  const tenantDb = withTenantGuard(prisma, tenantId);
  for (let i = 0; i < iterations; i++) {
    await authzKitGetUserPosts(userId, tenantDb);
  }
  const authzKitTime = performance.now() - authzKitStart;

  console.log(`Manual validation: ${manualTime.toFixed(2)}ms`);
  console.log(`AuthzKit protection: ${authzKitTime.toFixed(2)}ms`);
  console.log(`Performance impact: ${((authzKitTime - manualTime) / manualTime * 100).toFixed(2)}%`);
};
```

## Gradual Migration Approach

### Phase 1: Add AuthzKit alongside existing validation

```typescript
// Keep both implementations during transition
const getUserPosts = async (userId: number, tenantId: string) => {
  // Continue using manual validation
  const manualResult = await manualGetUserPosts(userId, tenantId);

  // Add AuthzKit implementation for comparison
  if (process.env.AUTHZKIT_VALIDATION_ENABLED === 'true') {
    const tenantDb = withTenantGuard(prisma, tenantId);
    const authzKitResult = await tenantDb.post.findMany({
      where: { authorId: userId }
    });

    // Log differences for investigation
    if (!deepEqual(manualResult, authzKitResult)) {
      logger.warn('AuthzKit vs manual validation mismatch', {
        manual: manualResult.length,
        authzkit: authzKitResult.length,
        userId,
        tenantId
      });
    }
  }

  return manualResult;
};
```

### Phase 2: Switch to AuthzKit with manual fallback

```typescript
const getUserPosts = async (userId: number, tenantId: string) => {
  if (process.env.AUTHZKIT_PRIMARY === 'true') {
    try {
      const tenantDb = withTenantGuard(prisma, tenantId);
      return await tenantDb.post.findMany({
        where: { authorId: userId }
      });
    } catch (error) {
      logger.error('AuthzKit implementation failed, falling back to manual', error);
      return await manualGetUserPosts(userId, tenantId);
    }
  } else {
    return await manualGetUserPosts(userId, tenantId);
  }
};
```

### Phase 3: Full AuthzKit implementation

```typescript
const getUserPosts = async (userId: number, tenantId: string) => {
  const tenantDb = withTenantGuard(prisma, tenantId);
  return await tenantDb.post.findMany({
    where: { authorId: userId }
  });
};
```

## Common Migration Issues

### Issue 1: Inconsistent Tenant Field Names

**Problem**: Different models use different field names for tenant identification

**Solution**: Standardize before migration or configure custom field names

```prisma
// Standardize field names
model User {
  organizationId String // Rename to tenantId
}

// Or configure custom field name
generator tenantGuard {
  provider    = "@authzkit/prisma-tenant-guard-generator"
  tenantField = "organizationId"
}
```

### Issue 2: Missing Composite Constraints

**Problem**: Existing schema lacks composite unique constraints

**Solution**: Add constraints and handle potential data conflicts

```sql
-- Check for duplicate combinations before adding constraint
SELECT "tenantId", "id", COUNT(*)
FROM "User"
GROUP BY "tenantId", "id"
HAVING COUNT(*) > 1;

-- Resolve duplicates then add constraint
ALTER TABLE "User" ADD CONSTRAINT "tenantId_id" UNIQUE ("tenantId", "id");
```

### Issue 3: Complex Existing Queries

**Problem**: Complex queries with extensive manual tenant filtering

**Solution**: Migrate gradually, starting with simple operations

```typescript
// Start with simple operations
const simpleUserQuery = async (id: number, tenantId: string) => {
  const tenantDb = withTenantGuard(prisma, tenantId);
  return tenantDb.user.findUnique({ where: { id } });
};

// Migrate complex operations later
const complexUserQuery = async (filters: UserFilters, tenantId: string) => {
  // Keep manual implementation initially
  // Migrate after simple operations are stable
};
```

## Post-Migration Validation

### Cleanup Checklist

- [ ] Remove manual tenant validation code
- [ ] Update tests to use AuthzKit
- [ ] Remove tenant filtering from where clauses
- [ ] Update documentation
- [ ] Train team on AuthzKit patterns

### Monitoring Setup

```typescript
// Set up monitoring for AuthzKit in production
const monitoredTenantDb = withTenantGuard(prisma, tenantId, {
  mode: 'strict',
  meta: tenantMeta,
  onWarn: (warning) => {
    monitoring.warn('authzkit_warning', { warning, tenantId });
  },
  onError: (error) => {
    monitoring.error('authzkit_error', { error, tenantId });
    alerting.sendSecurityAlert('tenant_violation_blocked', { error, tenantId });
  }
});
```

### Success Metrics

Track these metrics to validate successful migration:

- **Security**: Zero cross-tenant data leakage incidents
- **Performance**: Comparable or improved query performance
- **Code Quality**: Reduced lines of tenant validation code
- **Developer Experience**: Faster feature development
- **Maintainability**: Fewer tenant-related bugs

---

**Congratulations on completing your AuthzKit migration!** Your application now has automatic, bulletproof tenant isolation.