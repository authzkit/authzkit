# Configuration

Comprehensive configuration guide for AuthzKit Tenant Guard covering all modes, options, and deployment scenarios.

## Basic Configuration

### Core Options

The `CreateTenantClientOptions` interface provides all configuration options:

```typescript
import {
  tenantGuardExtension,
  type CreateTenantClientOptions,
  type Mode,
} from '@authzkit/prisma-tenant-guard';

const options: CreateTenantClientOptions = {
  tenantId: 'tenant-123',      // Required: Current tenant ID
  mode: 'assist',              // Required: AuthzKit operation mode
  meta: tenantMeta,            // Required: Generated metadata
  rls?: {                      // Optional: PostgreSQL RLS integration
    enabled: true,
    varName: 'authzkit.tenant_id'
  },
  onWarn?: (warning) => { },   // Optional: Warning callback
  onError?: (error) => { },    // Optional: Error callback
};

const tenantDb = prisma.$extends(tenantGuardExtension(options));
```

## Operation Modes

AuthzKit supports three operation modes with different security and development characteristics:

### Assist Mode (Recommended for Development)

**Mode**: `'assist'`

Auto-injection mode that gracefully handles missing tenant fields:

```typescript
const tenantDb = withTenantGuard(prisma, tenantId, 'assist');

// Missing tenantId is automatically injected
await tenantDb.user.create({
  data: {
    // tenantId: omitted - AuthzKit auto-injects
    email: 'user@example.com',
    name: 'John Doe',
  }
});
// ✅ Works: tenantId automatically added
```

**Characteristics**:
- ✅ Auto-injects missing `tenantId` fields
- ✅ Provides warning logs for visibility
- ✅ Graceful handling reduces development friction
- ⚠️ May hide missing tenant field specifications

**Best for**: Development, testing, prototyping

### Strict Mode (Recommended for Production)

**Mode**: `'strict'`

Explicit validation mode that requires all tenant fields:

```typescript
const tenantDb = withTenantGuard(prisma, tenantId, 'strict');

// Must provide explicit tenantId
await tenantDb.user.create({
  data: {
    tenantId: tenantId,  // Required in strict mode
    email: 'user@example.com',
    name: 'John Doe',
  }
});
// ✅ Works: explicit tenant specification

await tenantDb.user.create({
  data: {
    // tenantId: omitted
    email: 'user@example.com',
    name: 'John Doe',
  }
});
// ❌ Throws: TENANT_FIELD_MISSING error
```

**Characteristics**:
- ✅ Forces explicit tenant field specification
- ✅ No hidden auto-injection behavior
- ✅ Clear errors for debugging
- ✅ Full tenant isolation protection

**Best for**: Production, code reviews, explicit validation

### Assert Mode (Experimental)

**Mode**: `'assert'`

Advanced validation mode with enhanced checking:

```typescript
const tenantDb = withTenantGuard(prisma, tenantId, 'assert');
```

**Characteristics**:
- ⚠️ Experimental mode
- ✅ Enhanced validation checks
- ✅ Full tenant isolation protection
- 📝 Documentation in progress

**Best for**: Advanced use cases (when documented)

## Environment-based Configuration

### Environment Variables

Configure AuthzKit behavior through environment variables:

```bash
# Primary mode configuration
TENANT_GUARD_MODE=assist          # assist|strict|assert

# PostgreSQL RLS integration
TENANT_GUARD_RLS=true            # Enable RLS integration
TENANT_GUARD_VAR=authzkit.tenant_id # RLS session variable name

# Logging configuration
TENANT_GUARD_LOG_LEVEL=warn      # error|warn|info|debug
TENANT_GUARD_SILENT=false        # Disable all logging
```

### Dynamic Mode Selection

```typescript
const getMode = (): Mode => {
  if (process.env.NODE_ENV === 'production') return 'strict';
  if (process.env.NODE_ENV === 'test') return 'strict';
  return 'assist'; // development
};

export const withTenantGuard = (prisma: PrismaClient, tenantId: string) => {
  return prisma.$extends(tenantGuardExtension({
    tenantId,
    mode: getMode(),
    meta: tenantMeta,
  }));
};
```

## PostgreSQL RLS Integration

### Enable RLS Integration

```typescript
const options: CreateTenantClientOptions = {
  tenantId,
  mode: 'assist',
  meta: tenantMeta,
  rls: {
    enabled: true,
    varName: 'authzkit.tenant_id', // Default variable name
  },
};
```

### Database Setup

Create RLS policies that work with AuthzKit:

```sql
-- Enable RLS on tables
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Post" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Comment" ENABLE ROW LEVEL SECURITY;

-- Create tenant isolation policies
CREATE POLICY "tenant_isolation_user" ON "User"
  USING (current_setting('authzkit.tenant_id', true) = "tenantId");

CREATE POLICY "tenant_isolation_post" ON "Post"
  USING (current_setting('authzkit.tenant_id', true) = "tenantId");

CREATE POLICY "tenant_isolation_comment" ON "Comment"
  USING (current_setting('authzkit.tenant_id', true) = "tenantId");
```

### Custom RLS Variable

```typescript
const options: CreateTenantClientOptions = {
  tenantId,
  mode: 'assist',
  meta: tenantMeta,
  rls: {
    enabled: true,
    varName: 'myapp.current_tenant', // Custom variable name
  },
};
```

Update your RLS policies accordingly:

```sql
CREATE POLICY "tenant_isolation" ON "User"
  USING (current_setting('myapp.current_tenant', true) = "tenantId");
```

## Logging and Monitoring

### Warning Callbacks

Monitor AuthzKit auto-injection behavior:

```typescript
const options: CreateTenantClientOptions = {
  tenantId,
  mode: 'assist',
  meta: tenantMeta,
  onWarn: (warning) => {
    console.log(`🔧 AuthzKit ${warning.code}: ${warning.model}.${warning.operation} at ${warning.path}`);

    // Send to monitoring service
    monitoring.warn('authzkit_auto_injection', {
      code: warning.code,
      model: warning.model,
      operation: warning.operation,
      path: warning.path,
      tenantId: tenantId,
    });
  },
};
```

### Error Callbacks

Handle AuthzKit validation errors:

```typescript
const options: CreateTenantClientOptions = {
  tenantId,
  mode: 'strict',
  meta: tenantMeta,
  onError: (error) => {
    console.error(`❌ AuthzKit Error: ${error.code} - ${error.message}`);

    // Log to error tracking service
    errorTracking.captureException(error, {
      tags: {
        authzkit_error: error.code,
        tenant_id: tenantId,
      },
    });
  },
};
```

### Structured Logging

Integrate with structured logging systems:

```typescript
import { createLogger } from 'winston';

const logger = createLogger({
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

const options: CreateTenantClientOptions = {
  tenantId,
  mode: 'assist',
  meta: tenantMeta,
  onWarn: (warning) => {
    logger.warn('AuthzKit auto-injection', {
      authzkit: {
        code: warning.code,
        model: warning.model,
        operation: warning.operation,
        path: warning.path,
      },
      tenant: { id: tenantId },
    });
  },
  onError: (error) => {
    logger.error('AuthzKit validation error', {
      authzkit: {
        code: error.code,
        message: error.message,
      },
      tenant: { id: tenantId },
    });
  },
};
```

## Performance Configuration

### Metadata Caching

Cache tenant metadata for performance:

```typescript
let cachedMeta: TenantMeta | null = null;

const getTenantMeta = (): TenantMeta => {
  if (!cachedMeta) {
    cachedMeta = require('../.prisma/tenant-guard/meta.json');
  }
  return cachedMeta;
};

export const withTenantGuard = (prisma: PrismaClient, tenantId: string) => {
  return prisma.$extends(tenantGuardExtension({
    tenantId,
    mode: 'assist',
    meta: getTenantMeta(), // Use cached metadata
  }));
};
```

### Client Instance Reuse

Reuse tenant client instances:

```typescript
const tenantClients = new Map<string, ReturnType<typeof withTenantGuard>>();

export const getTenantClient = (prisma: PrismaClient, tenantId: string) => {
  if (!tenantClients.has(tenantId)) {
    const tenantDb = withTenantGuard(prisma, tenantId);
    tenantClients.set(tenantId, tenantDb);
  }
  return tenantClients.get(tenantId)!;
};
```

## Development vs Production

### Development Configuration

```typescript
// development.ts
export const createTenantClient = (prisma: PrismaClient, tenantId: string) => {
  return prisma.$extends(tenantGuardExtension({
    tenantId,
    mode: 'assist',          // Auto-injection for easier development
    meta: tenantMeta,
    onWarn: (warning) => {
      // Detailed logging in development
      console.warn(`🔧 AuthzKit: ${warning.model}.${warning.operation} at ${warning.path}`);
    },
  }));
};
```

### Production Configuration

```typescript
// production.ts
export const createTenantClient = (prisma: PrismaClient, tenantId: string) => {
  return prisma.$extends(tenantGuardExtension({
    tenantId,
    mode: 'strict',          // Explicit validation in production
    meta: tenantMeta,
    rls: {
      enabled: true,         // Enable RLS for defense in depth
      varName: 'authzkit.tenant_id',
    },
    onWarn: (warning) => {
      // Structured logging in production
      logger.warn('authzkit_warning', { warning, tenantId });
    },
    onError: (error) => {
      // Error tracking in production
      errorTracker.captureException(error, { tenantId });
    },
  }));
};
```

### Environment-specific Factory

```typescript
const createTenantClient = (prisma: PrismaClient, tenantId: string) => {
  const isProduction = process.env.NODE_ENV === 'production';

  return prisma.$extends(tenantGuardExtension({
    tenantId,
    mode: isProduction ? 'strict' : 'assist',
    meta: tenantMeta,
    rls: {
      enabled: isProduction,
      varName: 'authzkit.tenant_id',
    },
    onWarn: isProduction
      ? (warning) => logger.warn('authzkit_warning', { warning, tenantId })
      : (warning) => console.warn(`🔧 AuthzKit: ${warning.code} at ${warning.path}`),
  }));
};
```

## Testing Configuration

### Test Environment Setup

```typescript
// test-utils.ts
export const createTestTenantClient = (tenantId: string = 'test-tenant') => {
  return prisma.$extends(tenantGuardExtension({
    tenantId,
    mode: 'strict',          // Use strict mode for tests
    meta: tenantMeta,
    onWarn: jest.fn(),       // Mock callbacks for testing
    onError: jest.fn(),
  }));
};
```

### Integration Tests

```typescript
describe('AuthzKit Tenant Guard', () => {
  it('should block cross-tenant operations', async () => {
    const tenant1Db = createTestTenantClient('tenant-1');
    const tenant2Db = createTestTenantClient('tenant-2');

    // Create user in tenant-1
    const user = await tenant1Db.user.create({
      data: { tenantId: 'tenant-1', email: 'user@example.com', name: 'User' }
    });

    // Try to access from tenant-2 (should fail)
    await expect(
      tenant2Db.user.findUnique({ where: { id: user.id } })
    ).resolves.toBeNull();
  });
});
```

## Configuration Best Practices

### 1. Mode Selection Strategy

```typescript
const getModeForEnvironment = (): Mode => {
  switch (process.env.NODE_ENV) {
    case 'production':
      return 'strict';    // Explicit validation in production
    case 'staging':
      return 'strict';    // Test production behavior in staging
    case 'test':
      return 'strict';    // Consistent behavior in tests
    default:
      return 'assist';    // Auto-injection for development
  }
};
```

### 2. Centralized Configuration

```typescript
// config/tenant-guard.ts
export const tenantGuardConfig = {
  mode: getModeForEnvironment(),
  rls: {
    enabled: process.env.TENANT_GUARD_RLS === 'true',
    varName: process.env.TENANT_GUARD_VAR || 'authzkit.tenant_id',
  },
  logging: {
    warnings: process.env.NODE_ENV !== 'test',
    errors: true,
  },
} as const;
```

### 3. Type-safe Configuration

```typescript
type TenantGuardConfig = {
  mode: Mode;
  rls: {
    enabled: boolean;
    varName: string;
  };
  logging: {
    warnings: boolean;
    errors: boolean;
  };
};

export const createConfiguredTenantClient = (
  prisma: PrismaClient,
  tenantId: string,
  config: TenantGuardConfig
) => {
  return prisma.$extends(tenantGuardExtension({
    tenantId,
    mode: config.mode,
    meta: tenantMeta,
    rls: config.rls,
    onWarn: config.logging.warnings ? handleWarning : undefined,
    onError: config.logging.errors ? handleError : undefined,
  }));
};
```

---

**Next: [How It Works](/tenant-guard/concepts)** - Learn how AuthzKit works under the hood.