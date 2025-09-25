# Security Testing

Comprehensive guide to testing AuthzKit Tenant Guard protection mechanisms and verifying 100% tenant isolation in your application.

## Overview

AuthzKit security testing ensures that your multi-tenant application is protected against all forms of cross-tenant data violations. This guide provides testing strategies, tools, and real-world attack scenarios to verify complete protection.

## Quick Security Verification

### 1. Basic Cross-tenant Protection Test

```typescript
import { PrismaClient } from '@prisma/client';
import { withTenantGuard } from '../src/tenant-guard';

const prisma = new PrismaClient();

async function basicSecurityTest() {
  const tenant1Db = withTenantGuard(prisma, 'tenant-1');
  const tenant2Db = withTenantGuard(prisma, 'tenant-2');

  // Create user in tenant-1
  const user1 = await tenant1Db.user.create({
    data: {
      tenantId: 'tenant-1',
      email: 'alice@tenant1.com',
      name: 'Alice'
    }
  });

  // Try to access from tenant-2 (should be null)
  const crossTenantAccess = await tenant2Db.user.findUnique({
    where: { id: user1.id }
  });

  console.log('Cross-tenant access result:', crossTenantAccess); // Should be null

  // Verify tenant-1 can access its own data
  const legitimateAccess = await tenant1Db.user.findUnique({
    where: { id: user1.id }
  });

  console.log('Legitimate access result:', legitimateAccess); // Should return user
}

basicSecurityTest();
```

### 2. Nested Operation Protection Test

```typescript
async function nestedOperationTest() {
  const tenant1Db = withTenantGuard(prisma, 'tenant-1');
  const tenant2Db = withTenantGuard(prisma, 'tenant-2');

  // Create tag in tenant-1
  const tag1 = await tenant1Db.tag.create({
    data: {
      tenantId: 'tenant-1',
      name: 'Confidential',
      color: '#ff0000'
    }
  });

  try {
    // Try to connect tenant-1's tag to tenant-2's todo
    await tenant2Db.todo.create({
      data: {
        tenantId: 'tenant-2',
        title: 'Steal data',
        authorId: 3,
        tags: {
          connect: [{ id: tag1.id }] // Should be blocked
        }
      }
    });

    console.error('❌ SECURITY BREACH: Cross-tenant connection succeeded');
  } catch (error) {
    console.log('✅ PROTECTED: Cross-tenant connection blocked');
  }
}

nestedOperationTest();
```

## Comprehensive Test Suite

### Jest Test Framework

Create a comprehensive test suite using Jest:

```typescript
// tests/tenant-guard.test.ts
import { PrismaClient } from '@prisma/client';
import { withTenantGuard } from '../src/tenant-guard';

describe('AuthzKit Tenant Guard Security', () => {
  let prisma: PrismaClient;
  let tenant1Db: ReturnType<typeof withTenantGuard>;
  let tenant2Db: ReturnType<typeof withTenantGuard>;

  beforeAll(async () => {
    prisma = new PrismaClient();
    tenant1Db = withTenantGuard(prisma, 'tenant-1');
    tenant2Db = withTenantGuard(prisma, 'tenant-2');
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Basic Tenant Isolation', () => {
    it('should prevent cross-tenant user access', async () => {
      const user = await tenant1Db.user.create({
        data: {
          tenantId: 'tenant-1',
          email: 'test@example.com',
          name: 'Test User'
        }
      });

      const crossTenantUser = await tenant2Db.user.findUnique({
        where: { id: user.id }
      });

      expect(crossTenantUser).toBeNull();
    });

    it('should allow same-tenant access', async () => {
      const user = await tenant1Db.user.create({
        data: {
          tenantId: 'tenant-1',
          email: 'same@example.com',
          name: 'Same Tenant User'
        }
      });

      const sameTenantUser = await tenant1Db.user.findUnique({
        where: { id: user.id }
      });

      expect(sameTenantUser).not.toBeNull();
      expect(sameTenantUser?.tenantId).toBe('tenant-1');
    });
  });

  describe('Nested Operation Protection', () => {
    it('should block cross-tenant tag connections', async () => {
      const tag = await tenant1Db.tag.create({
        data: {
          tenantId: 'tenant-1',
          name: 'Secret Tag',
          color: '#ff0000'
        }
      });

      await expect(
        tenant2Db.todo.create({
          data: {
            tenantId: 'tenant-2',
            title: 'Malicious Todo',
            authorId: 3,
            tags: {
              connect: [{ id: tag.id }]
            }
          }
        })
      ).rejects.toThrow();
    });

    it('should allow same-tenant tag connections', async () => {
      const tag = await tenant1Db.tag.create({
        data: {
          tenantId: 'tenant-1',
          name: 'Legitimate Tag',
          color: '#00ff00'
        }
      });

      const todo = await tenant1Db.todo.create({
        data: {
          tenantId: 'tenant-1',
          title: 'Legitimate Todo',
          authorId: 1,
          tags: {
            connect: [{ id: tag.id }]
          }
        },
        include: {
          tags: { include: { tag: true } }
        }
      });

      expect(todo.tags).toHaveLength(1);
      expect(todo.tags[0].tag.id).toBe(tag.id);
    });
  });

  describe('Direct Relationship Manipulation', () => {
    it('should block direct TodoTag creation with cross-tenant IDs', async () => {
      const tag = await tenant1Db.tag.create({
        data: { tenantId: 'tenant-1', name: 'Tag', color: '#blue' }
      });

      const todo = await tenant2Db.todo.create({
        data: { tenantId: 'tenant-2', title: 'Todo', authorId: 3 }
      });

      await expect(
        tenant2Db.todoTag.create({
          data: {
            tenantId: 'tenant-2',
            todoId: todo.id,
            tagId: tag.id // Cross-tenant tag
          }
        })
      ).rejects.toThrow();
    });
  });

  describe('Auto-injection Testing', () => {
    it('should auto-inject tenantId in assist mode', async () => {
      const assistTenantDb = withTenantGuard(prisma, 'tenant-1', 'assist');

      const user = await assistTenantDb.user.create({
        data: {
          // tenantId omitted - should be auto-injected
          email: 'autoinjected@example.com',
          name: 'Auto User'
        }
      });

      expect(user.tenantId).toBe('tenant-1');
    });
  });
});
```

### Vitest Alternative

```typescript
// tests/tenant-guard.test.ts (Vitest)
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { withTenantGuard } from '../src/tenant-guard';

describe('AuthzKit Security Testing', () => {
  // Same test structure as Jest
});
```

## Real-World Attack Scenarios

### Attack Scenario 1: Corporate Espionage

Simulate a sophisticated attack where a malicious tenant tries to access competitor data:

```typescript
async function corporateEspionageTest() {
  console.log('🚨 Testing Corporate Espionage Attack...\n');

  const legitimateBusinessDb = withTenantGuard(prisma, 'acme-corp');
  const maliciousActorDb = withTenantGuard(prisma, 'evil-corp');

  // 1. Legitimate business creates confidential data
  const confidentialTag = await legitimateBusinessDb.tag.create({
    data: {
      tenantId: 'acme-corp',
      name: 'CONFIDENTIAL',
      color: '#ff0000'
    }
  });

  const businessPlan = await legitimateBusinessDb.todo.create({
    data: {
      tenantId: 'acme-corp',
      title: 'Q4 Business Strategy',
      description: 'Confidential business plans',
      authorId: 1,
      tags: {
        connect: [{ id: confidentialTag.id }]
      }
    }
  });

  // 2. Malicious actor attempts various attacks
  const attacks = [
    {
      name: 'Direct data access',
      test: () => maliciousActorDb.todo.findUnique({ where: { id: businessPlan.id } })
    },
    {
      name: 'Tag theft',
      test: () => maliciousActorDb.tag.findUnique({ where: { id: confidentialTag.id } })
    },
    {
      name: 'Cross-tenant connection',
      test: () => maliciousActorDb.todo.create({
        data: {
          tenantId: 'evil-corp',
          title: 'Stolen data',
          authorId: 5,
          tags: { connect: [{ id: confidentialTag.id }] }
        }
      })
    },
    {
      name: 'Relationship manipulation',
      test: () => maliciousActorDb.todoTag.create({
        data: {
          tenantId: 'evil-corp',
          todoId: businessPlan.id,
          tagId: confidentialTag.id
        }
      })
    }
  ];

  const results = [];
  for (const attack of attacks) {
    try {
      const result = await attack.test();
      if (result) {
        console.log(`❌ SECURITY BREACH: ${attack.name} succeeded`);
        results.push({ attack: attack.name, status: 'BREACH', result });
      } else {
        console.log(`✅ PROTECTED: ${attack.name} returned null`);
        results.push({ attack: attack.name, status: 'PROTECTED' });
      }
    } catch (error) {
      console.log(`✅ BLOCKED: ${attack.name} threw error`);
      results.push({ attack: attack.name, status: 'BLOCKED', error: error.message });
    }
  }

  return results;
}
```

### Attack Scenario 2: Mass Data Extraction

```typescript
async function massDataExtractionTest() {
  console.log('🚨 Testing Mass Data Extraction Attack...\n');

  const victim1Db = withTenantGuard(prisma, 'victim-1');
  const victim2Db = withTenantGuard(prisma, 'victim-2');
  const attackerDb = withTenantGuard(prisma, 'attacker');

  // Create data in victim tenants
  const victim1Data = await victim1Db.tag.createMany({
    data: [
      { tenantId: 'victim-1', name: 'Private-1', color: '#red' },
      { tenantId: 'victim-1', name: 'Secret-1', color: '#blue' }
    ]
  });

  const victim2Data = await victim2Db.tag.createMany({
    data: [
      { tenantId: 'victim-2', name: 'Private-2', color: '#green' },
      { tenantId: 'victim-2', name: 'Secret-2', color: '#yellow' }
    ]
  });

  // Attacker tries to steal all data
  try {
    const stolenTodo = await attackerDb.todo.create({
      data: {
        tenantId: 'attacker',
        title: 'Data harvest',
        authorId: 99,
        tags: {
          connect: [
            { id: 1 }, { id: 2 }, // victim-1 tags
            { id: 3 }, { id: 4 }  // victim-2 tags
          ]
        }
      }
    });

    console.log('❌ SECURITY BREACH: Mass data extraction succeeded');
    return { status: 'BREACH', data: stolenTodo };
  } catch (error) {
    console.log('✅ PROTECTED: Mass data extraction blocked');
    return { status: 'PROTECTED', error: error.message };
  }
}
```

## Automated Security Testing

### GitHub Actions CI/CD

Create automated security testing in your CI/CD pipeline:

```yaml
# .github/workflows/security-test.yml
name: AuthzKit Security Testing

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  security-test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Generate Prisma client and AuthzKit metadata
        run: npx prisma generate

      - name: Run security tests
        run: npm run test:security
        env:
          DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
          TENANT_GUARD_MODE: strict

      - name: Run attack simulations
        run: npm run test:attacks
```

### NPM Scripts

Add security testing scripts to your `package.json`:

```json
{
  "scripts": {
    "test:security": "jest tests/security --verbose",
    "test:attacks": "tsx tests/attack-scenarios.ts",
    "test:all": "npm run test:security && npm run test:attacks"
  }
}
```

## Load Testing with Tenant Isolation

### Performance Under Attack

Test AuthzKit performance under simulated attack conditions:

```typescript
// tests/load-test.ts
import { performance } from 'perf_hooks';

async function loadTestTenantIsolation() {
  const iterations = 1000;
  const tenants = ['tenant-1', 'tenant-2', 'tenant-3'];

  console.log(`Running ${iterations} operations across ${tenants.length} tenants...\n`);

  const start = performance.now();
  const results = [];

  for (let i = 0; i < iterations; i++) {
    const tenantId = tenants[i % tenants.length];
    const tenantDb = withTenantGuard(prisma, tenantId);

    try {
      // Simulate normal operations
      const user = await tenantDb.user.create({
        data: {
          tenantId,
          email: `user-${i}@${tenantId}.com`,
          name: `User ${i}`
        }
      });

      // Simulate cross-tenant attack
      const otherTenantId = tenants[(i + 1) % tenants.length];
      const attackerDb = withTenantGuard(prisma, otherTenantId);

      const attack = await attackerDb.user.findUnique({
        where: { id: user.id }
      });

      results.push({
        iteration: i,
        tenant: tenantId,
        legitimate: !!user,
        attack_blocked: !attack
      });

    } catch (error) {
      results.push({
        iteration: i,
        tenant: tenantId,
        error: error.message
      });
    }
  }

  const end = performance.now();
  const duration = end - start;

  // Analyze results
  const successful = results.filter(r => r.legitimate && r.attack_blocked);
  const breaches = results.filter(r => !r.attack_blocked && !r.error);

  console.log(`Performance Results:`);
  console.log(`Total time: ${duration.toFixed(2)}ms`);
  console.log(`Average per operation: ${(duration / iterations).toFixed(2)}ms`);
  console.log(`Successful protections: ${successful.length}/${iterations}`);
  console.log(`Security breaches: ${breaches.length}/${iterations}`);

  if (breaches.length > 0) {
    console.error('❌ SECURITY FAILURES DETECTED');
    return false;
  } else {
    console.log('✅ ALL OPERATIONS PROTECTED');
    return true;
  }
}
```

## Security Monitoring in Production

### Runtime Protection Monitoring

Monitor AuthzKit protection in production:

```typescript
// monitoring/security-monitor.ts
import { withTenantGuard } from '../src/tenant-guard';

const securityMetrics = {
  violations_blocked: 0,
  auto_injections: 0,
  legitimate_operations: 0
};

export const createMonitoredTenantClient = (prisma: PrismaClient, tenantId: string) => {
  return withTenantGuard(prisma, tenantId, {
    mode: 'assist',
    onWarn: (warning) => {
      securityMetrics.auto_injections++;

      // Log to monitoring service
      monitoring.increment('authzkit.auto_injection', {
        tags: {
          tenant_id: tenantId,
          model: warning.model,
          operation: warning.operation
        }
      });
    },
    onError: (error) => {
      securityMetrics.violations_blocked++;

      // Alert on security violations
      alerting.sendSecurityAlert({
        type: 'tenant_violation_blocked',
        tenant_id: tenantId,
        error_code: error.code,
        timestamp: new Date().toISOString()
      });
    }
  });
};

// Health check endpoint
export const getSecurityMetrics = () => securityMetrics;
```

### Compliance Testing

Test AuthzKit compliance with security standards:

```typescript
// tests/compliance.test.ts
describe('AuthzKit Compliance Testing', () => {
  it('should meet SOC 2 Type II requirements', async () => {
    // Test that tenant data is completely isolated
    // Verify audit trails are maintained
    // Ensure no data leakage between tenants
  });

  it('should meet GDPR requirements', async () => {
    // Test data deletion across tenant boundaries
    // Verify personal data isolation
    // Ensure right to be forgotten compliance
  });

  it('should meet HIPAA requirements', async () => {
    // Test healthcare data isolation
    // Verify access controls work correctly
    // Ensure audit logging is comprehensive
  });
});
```

## Security Test Checklist

Use this checklist to verify comprehensive AuthzKit protection:

### ✅ Basic Protection Tests
- [ ] Cross-tenant user access blocked
- [ ] Cross-tenant data queries return null/empty
- [ ] Same-tenant operations work correctly
- [ ] Auto-injection works in assist mode
- [ ] Strict mode blocks missing tenant fields

### ✅ Nested Operation Tests
- [ ] Cross-tenant connect operations blocked
- [ ] Cross-tenant create operations blocked
- [ ] Cross-tenant update operations blocked
- [ ] Complex nested operations validated
- [ ] Many-to-many relationships protected

### ✅ Advanced Attack Tests
- [ ] Corporate espionage scenario blocked
- [ ] Mass data extraction prevented
- [ ] Direct relationship manipulation blocked
- [ ] SQL injection attempts handled
- [ ] Authorization bypass attempts failed

### ✅ Performance Tests
- [ ] Load testing under attack conditions
- [ ] Performance impact measurement
- [ ] Memory usage monitoring
- [ ] Concurrent tenant operations
- [ ] Database connection efficiency

### ✅ Production Monitoring
- [ ] Security violation alerting
- [ ] Auto-injection monitoring
- [ ] Performance metrics collection
- [ ] Audit log generation
- [ ] Compliance reporting

---

**Next: [Troubleshooting](/tenant-guard/troubleshooting)** - Learn to diagnose and fix common issues.