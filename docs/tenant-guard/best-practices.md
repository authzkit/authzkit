# Best Practices

Production-tested recommendations for deploying AuthzKit Tenant Guard in real-world applications.

## Schema Design

### 1. Consistent Tenant Field Naming

Use consistent naming across your entire schema:

```prisma
// ✅ Good: Consistent naming
model User {
  id       Int    @id @default(autoincrement())
  tenantId String // Consistent field name
  email    String
}

model Post {
  id       Int    @id @default(autoincrement())
  tenantId String // Same field name
  title    String
}

// ❌ Avoid: Inconsistent naming
model User {
  organizationId String // Different name
}

model Post {
  companyId String // Another different name
}
```

### 2. Always Include Tenant in Composite Keys

Every model should have a composite unique constraint including the tenant field:

```prisma
// ✅ Required pattern
model User {
  id       Int    @id @default(autoincrement())
  tenantId String
  email    String

  @@unique([tenantId, id], map: "tenantId_id")
  @@unique([tenantId, email], map: "tenantId_email") // Unique email per tenant
}
```

### 3. Tenant-aware Foreign Keys

All foreign key relationships must include the tenant field:

```prisma
// ✅ Correct: Tenant-aware relationship
model Post {
  id       Int    @id @default(autoincrement())
  tenantId String
  authorId Int

  author User @relation(fields: [authorId, tenantId], references: [id, tenantId])
  //                           ^^^^^^^^              ^^^^^^^^

  @@unique([tenantId, id])
}

// ❌ Incorrect: Missing tenant in relationship
model Post {
  author User @relation(fields: [authorId], references: [id])
  //                           ^^^^^^^^             ^^^
  //                           Missing tenantId
}
```

### 4. Many-to-Many Tenant Isolation

Junction tables must include tenant fields:

```prisma
// ✅ Correct: Tenant in junction table
model TodoTag {
  tenantId String  // Required for isolation
  todoId   Int
  tagId    Int

  todo Todo @relation(fields: [todoId, tenantId], references: [id, tenantId])
  tag  Tag  @relation(fields: [tagId, tenantId], references: [id, tenantId])

  @@id([tenantId, todoId, tagId])
}
```

## Application Architecture

### 1. Centralized Tenant Client Factory

Create a single point for tenant client creation:

```typescript
// lib/tenant-db.ts
import { PrismaClient } from '@prisma/client';
import { withTenantGuard } from '@authzkit/prisma-tenant-guard';
import tenantMeta from '../.prisma/tenant-guard/meta.json';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export const createTenantDb = (tenantId: string) => {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  return withTenantGuard(prisma, tenantId, {
    meta: tenantMeta,
    mode: process.env.NODE_ENV === 'production' ? 'strict' : 'assist',
    rls: {
      enabled: process.env.DATABASE_RLS_ENABLED === 'true',
      varName: 'authzkit.tenant_id',
    },
  });
};

export type TenantDb = ReturnType<typeof createTenantDb>;
```

### 2. Request-scoped Tenant Context

Extract tenant context early in the request lifecycle:

```typescript
// middleware/tenant.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { createTenantDb } from '../lib/tenant-db';

export interface TenantRequest extends NextApiRequest {
  tenantId: string;
  tenantDb: TenantDb;
}

export const withTenant = (
  handler: (req: TenantRequest, res: NextApiResponse) => Promise<void>
) => {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const tenantId = req.headers['x-tenant-id'] as string;

    if (!tenantId) {
      return res.status(400).json({ error: 'Missing tenant ID header' });
    }

    const tenantDb = createTenantDb(tenantId);
    const tenantReq = req as TenantRequest;
    tenantReq.tenantId = tenantId;
    tenantReq.tenantDb = tenantDb;

    await handler(tenantReq, res);
  };
};
```

### 3. Type-safe API Handlers

Create type-safe handlers that enforce tenant context:

```typescript
// lib/api-handler.ts
import { NextApiResponse } from 'next';
import { TenantRequest } from '../middleware/tenant';

type ApiHandler<T = any> = (
  req: TenantRequest,
  res: NextApiResponse<T>
) => Promise<void>;

export const createApiHandler = <T = any>(handler: ApiHandler<T>) => {
  return withTenant(handler);
};

// Usage in API routes
export default createApiHandler(async (req, res) => {
  // req.tenantDb is guaranteed to be available
  const users = await req.tenantDb.user.findMany();
  res.json(users);
});
```

## Production Configuration

### 1. Environment-based Mode Selection

Configure AuthzKit modes appropriately for each environment:

```typescript
// config/authzkit.ts
type Environment = 'development' | 'test' | 'staging' | 'production';

const getAuthzKitMode = (env: Environment): Mode => {
  switch (env) {
    case 'development':
      return 'assist';    // Auto-injection for faster development
    case 'test':
      return 'strict';    // Explicit validation in tests
    case 'staging':
      return 'strict';    // Test production behavior
    case 'production':
      return 'strict';    // Explicit validation in production
    default:
      return 'assist';
  }
};

export const authzKitConfig = {
  mode: getAuthzKitMode(process.env.NODE_ENV as Environment),
  rls: {
    enabled: process.env.DATABASE_RLS_ENABLED === 'true',
    varName: process.env.AUTHZKIT_RLS_VAR || 'authzkit.tenant_id',
  },
  monitoring: {
    warnings: process.env.NODE_ENV !== 'test',
    errors: true,
  },
};
```

### 2. Comprehensive Error Handling

Implement proper error handling for AuthzKit validation failures:

```typescript
// lib/error-handler.ts
import { TenantGuardError } from '@authzkit/prisma-tenant-guard';

export const handleAuthzKitError = (error: unknown, tenantId: string) => {
  if (error instanceof TenantGuardError) {
    // Log security violation attempt
    securityLogger.warn('AuthzKit tenant violation blocked', {
      tenantId,
      errorCode: error.code,
      model: error.model,
      operation: error.operation,
      path: error.path,
      timestamp: new Date().toISOString(),
    });

    // Send security alert for production
    if (process.env.NODE_ENV === 'production') {
      securityAlerts.send({
        type: 'tenant_violation',
        severity: 'medium',
        tenantId,
        error: error.message,
      });
    }

    return {
      error: 'Operation not allowed',
      code: 'TENANT_VIOLATION',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    };
  }

  // Handle other errors...
  throw error;
};
```

### 3. Performance Monitoring

Monitor AuthzKit performance and auto-injection frequency:

```typescript
// lib/monitoring.ts
class AuthzKitMonitoring {
  private metrics = {
    operations: 0,
    autoInjections: 0,
    violations: 0,
    averageLatency: 0,
  };

  onWarn = (warning: AuthzKitWarning) => {
    this.metrics.autoInjections++;

    // Track auto-injection patterns
    monitoring.increment('authzkit.auto_injection', {
      model: warning.model,
      operation: warning.operation,
    });

    // Alert on high auto-injection rate
    if (this.metrics.autoInjections > 1000) {
      alerts.send('High AuthzKit auto-injection rate detected');
    }
  };

  onError = (error: TenantGuardError) => {
    this.metrics.violations++;

    // Track security violations
    monitoring.increment('authzkit.violation', {
      model: error.model,
      operation: error.operation,
    });

    // Immediate alert on violations
    securityAlerts.send({
      type: 'tenant_violation',
      error: error.message,
    });
  };

  getMetrics = () => this.metrics;
}

export const authzKitMonitoring = new AuthzKitMonitoring();
```

## Security Best Practices

### 1. Defense in Depth

Combine AuthzKit with other security measures:

```sql
-- PostgreSQL RLS policies as additional protection
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_user" ON "User"
  USING (current_setting('authzkit.tenant_id', true) = "tenantId");

-- Application-level tenant validation
CREATE OR REPLACE FUNCTION validate_tenant_access(tenant_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN tenant_id = current_setting('authzkit.tenant_id', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 2. Audit Logging

Log all tenant-related operations for compliance:

```typescript
// lib/audit-logger.ts
export const auditLogger = {
  logTenantOperation: (operation: {
    tenantId: string;
    userId?: string;
    model: string;
    operation: string;
    recordId?: number;
    timestamp: Date;
  }) => {
    auditLog.info('tenant_operation', {
      ...operation,
      source: 'authzkit_tenant_guard',
    });
  },

  logSecurityViolation: (violation: {
    tenantId: string;
    attemptedModel: string;
    attemptedOperation: string;
    violationType: string;
    blocked: boolean;
  }) => {
    auditLog.warn('security_violation', {
      ...violation,
      severity: 'high',
      source: 'authzkit_tenant_guard',
    });
  },
};
```

### 3. Regular Security Testing

Implement automated security testing:

```typescript
// tests/security/tenant-isolation.test.ts
describe('Tenant Isolation Security', () => {
  const tenant1Db = createTenantDb('tenant-1');
  const tenant2Db = createTenantDb('tenant-2');

  it('should prevent cross-tenant data access', async () => {
    const user1 = await tenant1Db.user.create({
      data: { tenantId: 'tenant-1', email: 'user1@test.com', name: 'User 1' }
    });

    // Attempt cross-tenant access
    const crossTenantUser = await tenant2Db.user.findUnique({
      where: { id: user1.id }
    });

    expect(crossTenantUser).toBeNull();
  });

  it('should block cross-tenant relationship creation', async () => {
    const tag1 = await tenant1Db.tag.create({
      data: { tenantId: 'tenant-1', name: 'Tag 1', color: '#red' }
    });

    await expect(
      tenant2Db.todo.create({
        data: {
          tenantId: 'tenant-2',
          title: 'Malicious Todo',
          authorId: 2,
          tags: { connect: [{ id: tag1.id }] }
        }
      })
    ).rejects.toThrow();
  });
});
```

## Development Workflow

### 1. Assist Mode Development

Use assist mode during development with monitoring:

```typescript
// development.ts
export const createDevTenantDb = (tenantId: string) => {
  return withTenantGuard(prisma, tenantId, {
    mode: 'assist',
    meta: tenantMeta,
    onWarn: (warning) => {
      console.warn(`🔧 AuthzKit: ${warning.model}.${warning.operation} at ${warning.path}`);

      // Track for later migration to strict mode
      devMetrics.autoInjections.push({
        model: warning.model,
        operation: warning.operation,
        path: warning.path,
        timestamp: new Date(),
      });
    },
  });
};
```

### 2. Gradual Migration to Strict Mode

Migrate from assist to strict mode gradually:

```typescript
// migration-helper.ts
class AuthzKitModeMigration {
  private autoInjectionLog: Array<{
    model: string;
    operation: string;
    path: string;
    count: number;
  }> = [];

  analyzeAutoInjections = () => {
    // Group by model and operation
    const grouped = this.autoInjectionLog.reduce((acc, item) => {
      const key = `${item.model}.${item.operation}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log('Auto-injection hotspots:');
    Object.entries(grouped)
      .sort(([, a], [, b]) => b - a)
      .forEach(([operation, count]) => {
        console.log(`${operation}: ${count} auto-injections`);
      });
  };

  generateMigrationTasks = () => {
    // Generate list of operations that need explicit tenant fields
    return this.autoInjectionLog.map(item => ({
      task: `Add explicit tenantId to ${item.model}.${item.operation}`,
      location: item.path,
      priority: 'high',
    }));
  };
}
```

### 3. Code Review Guidelines

Establish team guidelines for AuthzKit usage:

```markdown
## AuthzKit Tenant Guard Code Review Checklist

### Schema Changes
- [ ] New models include `tenantId` field
- [ ] Composite unique constraints include `tenantId`
- [ ] Foreign key relationships include `tenantId`
- [ ] Junction tables include `tenantId`

### Application Code
- [ ] All database operations use `tenantDb` (not raw `prisma`)
- [ ] Tenant ID extraction is handled consistently
- [ ] Error handling includes AuthzKit validation errors
- [ ] No hardcoded tenant IDs in business logic

### Testing
- [ ] Cross-tenant access tests included
- [ ] Nested operation security tests added
- [ ] Performance impact assessed
- [ ] Security violation scenarios tested
```

## Performance Optimization

### 1. Tenant Client Caching

Cache tenant clients for performance:

```typescript
// lib/tenant-cache.ts
class TenantClientCache {
  private cache = new Map<string, TenantDb>();
  private maxSize = 1000;

  get(tenantId: string): TenantDb {
    if (!this.cache.has(tenantId)) {
      // Evict oldest if cache is full
      if (this.cache.size >= this.maxSize) {
        const firstKey = this.cache.keys().next().value;
        this.cache.delete(firstKey);
      }

      const tenantDb = createTenantDb(tenantId);
      this.cache.set(tenantId, tenantDb);
    }

    return this.cache.get(tenantId)!;
  }

  clear() {
    this.cache.clear();
  }
}

export const tenantClientCache = new TenantClientCache();
```

### 2. Metadata Optimization

Optimize metadata loading:

```typescript
// lib/metadata-loader.ts
let cachedMeta: TenantMeta | null = null;

export const getTenantMeta = (): TenantMeta => {
  if (!cachedMeta) {
    // Load metadata once at startup
    cachedMeta = require('../.prisma/tenant-guard/meta.json');

    // Freeze to prevent modifications
    Object.freeze(cachedMeta);
  }

  return cachedMeta;
};
```

### 3. Connection Pool Management

Optimize database connections:

```typescript
// lib/database.ts
const createPrismaClient = () => {
  return new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    // Optimize connection pool for multi-tenant workloads
    // Note: These are examples, adjust based on your needs
  });
};
```

## Monitoring and Observability

### 1. Key Metrics to Track

Monitor these AuthzKit-specific metrics:

```typescript
// monitoring/metrics.ts
export const authzKitMetrics = {
  // Security metrics
  'authzkit.violations.total': 'Counter for blocked tenant violations',
  'authzkit.violations.by_model': 'Counter by model type',

  // Performance metrics
  'authzkit.operation.duration': 'Histogram of operation validation time',
  'authzkit.auto_injection.total': 'Counter for auto-injections',

  // Usage metrics
  'authzkit.tenants.active': 'Gauge of active tenants',
  'authzkit.operations.by_tenant': 'Counter of operations per tenant',
};
```

### 2. Dashboard Widgets

Create monitoring dashboards:

- **Security Dashboard**: Violation attempts, blocked operations
- **Performance Dashboard**: Operation latency, auto-injection frequency
- **Usage Dashboard**: Active tenants, operation volume per tenant

### 3. Alerting Rules

Set up appropriate alerts:

```yaml
# monitoring/alerts.yml
alerts:
  - name: High AuthzKit Violation Rate
    condition: rate(authzkit_violations_total[5m]) > 10
    severity: high

  - name: AuthzKit Auto-injection Spike
    condition: rate(authzkit_auto_injection_total[1m]) > 100
    severity: medium

  - name: AuthzKit Operation Latency
    condition: histogram_quantile(0.95, authzkit_operation_duration) > 100ms
    severity: medium
```

---

**Next: [Troubleshooting](/tenant-guard/troubleshooting)** - Learn to diagnose and fix common issues.