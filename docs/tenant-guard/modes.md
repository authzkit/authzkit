# Security Modes

AuthzKit Tenant Guard operates in three distinct modes, each designed for different development stages and security requirements. Understanding these modes is crucial for effective deployment and debugging.

## Mode Overview

| Mode | Auto-injection | Error Behavior | Use Case |
|------|----------------|----------------|----------|
| **`assist`** | ✅ Yes | Warns + Auto-corrects | Development, Testing |
| **`strict`** | ❌ No | Throws errors | Production, Code Review |
| **`assert`** | ❌ No | Enhanced validation | Advanced use cases |

## Assist Mode

**Mode identifier**: `'assist'`

Assist mode is designed for development environments where productivity and ease of use are prioritized alongside security.

### Behavior

- **Auto-injection**: Automatically injects missing `tenantId` fields
- **Warning logs**: Provides detailed warnings when auto-injection occurs
- **Graceful handling**: Operations succeed with automatic corrections
- **Debugging support**: Clear visibility into what AuthzKit is doing

### Example

```typescript
const tenantDb = withTenantGuard(prisma, 'tenant-123', 'assist');

// Missing tenantId - AuthzKit auto-injects
await tenantDb.user.create({
  data: {
    // tenantId: omitted
    email: 'user@example.com',
    name: 'John Doe'
  }
});

// Console output:
// 🔧 AuthzKit INJECT_TENANT_FIELD: User.create at User.data
```

### Auto-injection Examples

#### Simple Field Injection

```typescript
// You write:
await tenantDb.tag.create({
  data: {
    name: 'Important',
    color: '#ff0000'
  }
});

// AuthzKit executes:
await prisma.tag.create({
  data: {
    tenantId: 'tenant-123', // ← Auto-injected
    name: 'Important',
    color: '#ff0000'
  }
});

// Warning log:
// 🔧 AuthzKit INJECT_TENANT_FIELD: Tag.create at Tag.data
```

#### Nested Operation Injection

```typescript
// Complex nested operation
await tenantDb.todo.create({
  data: {
    title: 'New Task',
    tags: {
      create: [
        { name: 'urgent', color: '#red' }
        // tenantId auto-injected here too
      ]
    }
  }
});

// Warning logs:
// 🔧 AuthzKit INJECT_TENANT_FIELD: Todo.create at Todo.data
// 🔧 AuthzKit INJECT_TENANT_FIELD: TodoTag.create at Todo.data.tags.create[0]
```

#### Where Clause Injection

```typescript
// You write:
await tenantDb.user.findUnique({ where: { id: 123 } });

// AuthzKit executes:
await prisma.user.findUnique({
  where: {
    tenantId_id: {
      tenantId: 'tenant-123', // ← Auto-injected
      id: 123
    }
  }
});

// Warning log:
// 🔧 AuthzKit INJECT_TENANT_WHERE: User.findUnique at User.where
```

### Configuration

```typescript
export const withTenantGuard = (prisma: PrismaClient, tenantId: string) => {
  return prisma.$extends(tenantGuardExtension({
    tenantId,
    mode: 'assist',
    meta: tenantMeta,
    onWarn: (warning) => {
      // Custom warning handler
      console.warn(`🔧 AuthzKit ${warning.code}: ${warning.model}.${warning.operation} at ${warning.path}`);

      // Optional: Send to monitoring
      monitoring.warn('authzkit_auto_injection', {
        code: warning.code,
        model: warning.model,
        operation: warning.operation,
        path: warning.path
      });
    }
  }));
};
```

### When to Use Assist Mode

**✅ Recommended for:**
- Development environments
- Rapid prototyping
- Learning AuthzKit behavior
- Debugging tenant issues
- Migration from non-tenant-aware code

**⚠️ Consider carefully for:**
- Production environments (may hide missing specifications)
- Code reviews (auto-injection might mask issues)
- Team environments where explicit validation is preferred

---

## Strict Mode

**Mode identifier**: `'strict'`

Strict mode enforces explicit tenant field specification and provides clear errors for debugging.

### Behavior

- **No auto-injection**: All tenant fields must be explicitly provided
- **Immediate errors**: Throws `TenantGuardError` for missing fields
- **Explicit validation**: Forces developers to be intentional about tenant isolation
- **Production-ready**: No hidden behavior or automatic corrections

### Example

```typescript
const tenantDb = withTenantGuard(prisma, 'tenant-123', 'strict');

// ✅ This works - explicit tenantId
await tenantDb.user.create({
  data: {
    tenantId: 'tenant-123',
    email: 'user@example.com',
    name: 'John Doe'
  }
});

// ❌ This fails - missing tenantId
await tenantDb.user.create({
  data: {
    email: 'user@example.com',
    name: 'John Doe'
  }
});
// Throws: TenantGuardError: Tenant guard: missing tenant field for User.create
```

### Error Examples

#### Missing Tenant Field Error

```typescript
try {
  await tenantDb.tag.create({
    data: {
      name: 'Important',
      color: '#ff0000'
      // Missing tenantId
    }
  });
} catch (error) {
  console.error(error.message);
  // TenantGuardError: Tenant guard: missing tenant field for Tag.create
  // Operation: tags.create.data
  // Expected field: tenantId
}
```

#### Tenant Mismatch Error

```typescript
try {
  await tenantDb.user.create({
    data: {
      tenantId: 'wrong-tenant', // Wrong tenant
      email: 'user@example.com',
      name: 'John Doe'
    }
  });
} catch (error) {
  console.error(error.message);
  // TenantGuardError: Tenant guard: tenant mismatch for User.create
  // Expected: 'tenant-123', Actual: 'wrong-tenant'
}
```

#### Nested Operation Error

```typescript
try {
  await tenantDb.todo.create({
    data: {
      tenantId: 'tenant-123',
      title: 'New Task',
      tags: {
        create: [
          { name: 'urgent', color: '#red' }
          // Missing tenantId in nested operation
        ]
      }
    }
  });
} catch (error) {
  console.error(error.message);
  // TenantGuardError: Tenant guard: missing tenant field for TodoTag.create
  // Operation: todos.create.data.tags.create[0]
  // Expected field: tenantId
}
```

### Configuration

```typescript
export const withTenantGuard = (prisma: PrismaClient, tenantId: string) => {
  return prisma.$extends(tenantGuardExtension({
    tenantId,
    mode: 'strict',
    meta: tenantMeta,
    onError: (error) => {
      // Custom error handler
      console.error(`❌ AuthzKit Error: ${error.code} - ${error.message}`);

      // Log to error tracking
      errorTracker.captureException(error, {
        tags: {
          authzkit_error: error.code,
          tenant_id: tenantId
        }
      });
    }
  }));
};
```

### When to Use Strict Mode

**✅ Recommended for:**
- Production environments
- Code reviews and quality assurance
- Teams preferring explicit validation
- CI/CD pipelines
- Security-critical applications

**⚠️ May require more work for:**
- Rapid prototyping
- Learning environments
- Migrating existing codebases

---

## Assert Mode

**Mode identifier**: `'assert'`

Assert mode is an experimental mode that provides enhanced validation capabilities.

### Behavior

- **No auto-injection**: Like strict mode, requires explicit fields
- **Enhanced validation**: Additional checks beyond basic tenant validation
- **Experimental features**: Access to advanced AuthzKit capabilities
- **Future-proof**: Platform for new validation features

### Example

```typescript
const tenantDb = withTenantGuard(prisma, 'tenant-123', 'assert');

// Same explicit requirements as strict mode
await tenantDb.user.create({
  data: {
    tenantId: 'tenant-123', // Required
    email: 'user@example.com',
    name: 'John Doe'
  }
});
```

### Enhanced Validation Features

Current assert mode includes all strict mode validation plus:

- **Advanced relationship validation**: Enhanced cross-model checks
- **Experimental type safety**: Additional TypeScript validations
- **Future capabilities**: Platform for new security features

### Configuration

```typescript
export const withTenantGuard = (prisma: PrismaClient, tenantId: string) => {
  return prisma.$extends(tenantGuardExtension({
    tenantId,
    mode: 'assert',
    meta: tenantMeta,
    // Enhanced configuration options available
    experimental: {
      advancedValidation: true,
      typeChecking: true
    }
  }));
};
```

### When to Use Assert Mode

**✅ Consider for:**
- Advanced validation requirements
- Experimental feature testing
- Future-proofing applications
- Enhanced security needs

**⚠️ Note:**
- Experimental mode - features may change
- Documentation and examples limited
- Use strict mode for production unless specific assert features needed

---

## Mode Selection Strategy

### Environment-based Selection

```typescript
const getModeForEnvironment = (): Mode => {
  switch (process.env.NODE_ENV) {
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

export const withTenantGuard = (prisma: PrismaClient, tenantId: string) => {
  return prisma.$extends(tenantGuardExtension({
    tenantId,
    mode: getModeForEnvironment(),
    meta: tenantMeta
  }));
};
```

### Feature Flag Selection

```typescript
const getMode = (): Mode => {
  if (featureFlags.authzKitAssertMode) return 'assert';
  if (featureFlags.authzKitStrictMode) return 'strict';
  return 'assist';
};
```

### Dynamic Mode Switching

```typescript
export const createTenantClient = (
  prisma: PrismaClient,
  tenantId: string,
  options?: { mode?: Mode }
) => {
  const mode = options?.mode ?? getModeForEnvironment();

  return prisma.$extends(tenantGuardExtension({
    tenantId,
    mode,
    meta: tenantMeta
  }));
};
```

## Mode Comparison in Practice

### Development Workflow

#### Assist Mode Development
```typescript
// Development: Quick and forgiving
const devDb = withTenantGuard(prisma, tenantId, 'assist');

await devDb.todo.create({
  data: {
    title: 'Quick prototype',
    // tenantId auto-injected - fast development
  }
});
```

#### Strict Mode Testing
```typescript
// Testing: Explicit and validated
const testDb = withTenantGuard(prisma, tenantId, 'strict');

await testDb.todo.create({
  data: {
    tenantId: tenantId, // Explicitly required
    title: 'Tested feature',
  }
});
```

### Migration Strategy

When transitioning from assist to strict mode:

1. **Phase 1**: Use assist mode with monitoring
2. **Phase 2**: Review auto-injection logs
3. **Phase 3**: Add explicit tenant fields where auto-injection occurred
4. **Phase 4**: Switch to strict mode
5. **Phase 5**: Fix any remaining validation errors

```typescript
// Migration helper
const getMigrationMode = (): Mode => {
  const phase = process.env.AUTHZKIT_MIGRATION_PHASE;

  switch (phase) {
    case '1':
    case '2':
      return 'assist'; // Learning phase
    case '3':
    case '4':
    case '5':
    default:
      return 'strict'; // Production-ready phase
  }
};
```

## Best Practices by Mode

### Assist Mode Best Practices

1. **Monitor auto-injection logs** to understand where explicit fields are needed
2. **Use in development only** unless you specifically need auto-injection
3. **Set up monitoring** to track auto-injection frequency
4. **Plan migration to strict mode** for production deployment

### Strict Mode Best Practices

1. **Use in production** for explicit validation and clear error messages
2. **Test thoroughly** to ensure all tenant fields are properly specified
3. **Set up error monitoring** to catch any validation failures
4. **Document team guidelines** for explicit tenant field specification

### Assert Mode Best Practices

1. **Use experimentally** to access advanced features
2. **Monitor for changes** as features are experimental
3. **Fallback to strict mode** for production unless specific assert features needed
4. **Provide feedback** to help improve assert mode capabilities

---

**Next: [Auto-injection](/tenant-guard/auto-injection)** - Deep dive into how assist mode's auto-injection works.