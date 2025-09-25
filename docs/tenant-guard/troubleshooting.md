# Troubleshooting

Common issues and solutions when working with AuthzKit Tenant Guard.

## Installation Issues

### Generator Not Running

**Problem**: Metadata files not generated after `prisma generate`

**Symptoms**:
- No `.prisma/tenant-guard/` directory
- Missing `meta.json` and `meta.ts` files
- TypeScript import errors

**Solutions**:

1. **Verify generator configuration**:
   ```prisma
   generator tenantGuard {
     provider = "@authzkit/prisma-tenant-guard-generator"
   }
   ```

2. **Check package installation**:
   ```bash
   npm list @authzkit/prisma-tenant-guard
   # Should show installed version
   ```

3. **Regenerate explicitly**:
   ```bash
   npx prisma generate --generator tenantGuard
   ```

4. **Check for errors**:
   ```bash
   npx prisma generate --verbose
   ```

### Import Errors

**Problem**: Cannot import generated metadata

**Symptoms**:
- `Module not found` errors
- TypeScript compilation failures
- Runtime import errors

**Solutions**:

1. **Check file exists**:
   ```bash
   ls -la .prisma/tenant-guard/
   # Should show meta.json and meta.ts
   ```

2. **Use correct import syntax**:
   ```typescript
   // ✅ Correct
   import tenantMeta from '../.prisma/tenant-guard/meta.json' assert { type: 'json' };

   // ✅ Alternative for older TypeScript
   const tenantMeta = require('../.prisma/tenant-guard/meta.json');

   // ❌ Incorrect
   import tenantMeta from '.prisma/tenant-guard/meta.json';
   ```

3. **Update TypeScript config**:
   ```json
   {
     "compilerOptions": {
       "resolveJsonModule": true,
       "allowSyntheticDefaultImports": true
     }
   }
   ```

## Runtime Errors

### TenantGuardError: Missing Tenant Field

**Problem**: AuthzKit throws errors about missing tenant fields

**Error Message**:
```
TenantGuardError: Tenant guard: missing tenant field for User.create
Operation: users.create.data
Expected field: tenantId
```

**Causes**:
- Using strict mode without explicit tenant fields
- Nested operations missing tenant fields
- Schema design issues

**Solutions**:

1. **Add explicit tenant field**:
   ```typescript
   // ❌ Missing tenantId
   await tenantDb.user.create({
     data: {
       email: 'user@example.com',
       name: 'John Doe'
     }
   });

   // ✅ Include tenantId
   await tenantDb.user.create({
     data: {
       tenantId: currentTenantId,
       email: 'user@example.com',
       name: 'John Doe'
     }
   });
   ```

2. **Switch to assist mode** (development only):
   ```typescript
   const tenantDb = withTenantGuard(prisma, tenantId, 'assist');
   ```

3. **Fix nested operations**:
   ```typescript
   // ❌ Missing tenantId in nested create
   await tenantDb.todo.create({
     data: {
       tenantId: currentTenantId,
       title: 'Task',
       tags: {
         create: [
           { name: 'urgent', color: '#red' } // Missing tenantId
         ]
       }
     }
   });

   // ✅ Include tenantId in nested operations
   await tenantDb.todo.create({
     data: {
       tenantId: currentTenantId,
       title: 'Task',
       tags: {
         create: [
           { tenantId: currentTenantId, name: 'urgent', color: '#red' }
         ]
       }
     }
   });
   ```

### TenantGuardError: Tenant Mismatch

**Problem**: Provided tenant field doesn't match current tenant

**Error Message**:
```
TenantGuardError: Tenant guard: tenant mismatch for User.create
Expected: 'tenant-123', Actual: 'tenant-456'
```

**Causes**:
- Hardcoded tenant IDs in code
- Incorrect tenant context
- Copy-paste errors

**Solutions**:

1. **Use dynamic tenant ID**:
   ```typescript
   // ❌ Hardcoded tenant
   await tenantDb.user.create({
     data: {
       tenantId: 'tenant-123', // Hardcoded
       email: 'user@example.com'
     }
   });

   // ✅ Dynamic tenant
   await tenantDb.user.create({
     data: {
       tenantId: currentTenantId, // From context
       email: 'user@example.com'
     }
   });
   ```

2. **Verify tenant context**:
   ```typescript
   console.log('Current tenant:', currentTenantId);
   console.log('Provided tenant:', data.tenantId);
   ```

### Cross-tenant Operation Blocked

**Problem**: Operations fail when trying to connect cross-tenant data

**Error Message**:
```
Foreign key constraint violated on the foreign key
```

**Causes**:
- Attempting to connect objects from different tenants
- Incorrect relationship setup
- Data corruption

**Solutions**:

1. **Verify data belongs to same tenant**:
   ```typescript
   // Check before connecting
   const todo = await tenantDb.todo.findUnique({ where: { id: todoId } });
   const tag = await tenantDb.tag.findUnique({ where: { id: tagId } });

   if (!todo || !tag) {
     throw new Error('Object not found in current tenant');
   }
   ```

2. **Use correct tenant context**:
   ```typescript
   // Ensure both operations use same tenant context
   const tenantDb = withTenantGuard(prisma, tenantId);
   ```

3. **Check relationship configuration**:
   ```prisma
   model TodoTag {
     tenantId String
     todoId   Int
     tagId    Int

     // Verify relationships include tenantId
     todo Todo @relation(fields: [todoId, tenantId], references: [id, tenantId])
     tag  Tag  @relation(fields: [tagId, tenantId], references: [id, tenantId])
   }
   ```

## Schema Issues

### Models Not Included in Metadata

**Problem**: Some models missing from generated metadata

**Symptoms**:
- Models without tenant protection
- Empty metadata file
- Unexpected behavior

**Causes**:
- Models missing `tenantId` field
- No composite unique constraints
- Models excluded from generation

**Solutions**:

1. **Add tenant field and constraints**:
   ```prisma
   model User {
     id       Int    @id @default(autoincrement())
     tenantId String // Add this
     email    String

     @@unique([tenantId, id], map: "tenantId_id") // Add this
   }
   ```

2. **Check exclusions**:
   ```prisma
   generator tenantGuard {
     provider = "@authzkit/prisma-tenant-guard-generator"
     exclude  = ["SystemLog"] // Remove if needed
   }
   ```

3. **Verify generation**:
   ```bash
   npx prisma generate --verbose
   ```

### Relationship Mapping Errors

**Problem**: Relationships not properly mapped in metadata

**Symptoms**:
- Nested operations not validated
- Foreign key errors
- Inconsistent behavior

**Causes**:
- Missing tenant field in foreign keys
- Incorrect relationship syntax
- Schema design issues

**Solutions**:

1. **Include tenant in relationships**:
   ```prisma
   // ❌ Missing tenant in foreign key
   model Post {
     author User @relation(fields: [authorId], references: [id])
   }

   // ✅ Include tenant in foreign key
   model Post {
     author User @relation(fields: [authorId, tenantId], references: [id, tenantId])
   }
   ```

2. **Verify composite constraints exist**:
   ```prisma
   model User {
     @@unique([tenantId, id], map: "tenantId_id") // Required for relationships
   }
   ```

## Performance Issues

### Slow Operation Validation

**Problem**: AuthzKit validation adds significant latency

**Symptoms**:
- Increased response times
- Timeout errors
- Poor user experience

**Causes**:
- Complex nested operations
- Large payload sizes
- Inefficient metadata

**Solutions**:

1. **Optimize operation structure**:
   ```typescript
   // ❌ Very nested operation
   await tenantDb.todo.create({
     data: {
       title: 'Task',
       tags: {
         create: [
           {
             tag: {
               create: {
                 // Deep nesting increases validation time
               }
             }
           }
         ]
       }
     }
   });

   // ✅ Flatter structure
   const tag = await tenantDb.tag.create({ /* ... */ });
   const todo = await tenantDb.todo.create({
     data: {
       title: 'Task',
       tags: { connect: [{ id: tag.id }] }
     }
   });
   ```

2. **Cache tenant clients**:
   ```typescript
   const tenantClients = new Map();

   const getTenantClient = (tenantId: string) => {
     if (!tenantClients.has(tenantId)) {
       tenantClients.set(tenantId, withTenantGuard(prisma, tenantId));
     }
     return tenantClients.get(tenantId);
   };
   ```

3. **Use batch operations**:
   ```typescript
   // ❌ Multiple individual operations
   for (const item of items) {
     await tenantDb.item.create({ data: item });
   }

   // ✅ Batch operation
   await tenantDb.item.createMany({ data: items });
   ```

### Memory Usage Issues

**Problem**: High memory usage with AuthzKit

**Causes**:
- Large metadata files
- Memory leaks in tenant clients
- Inefficient caching

**Solutions**:

1. **Monitor metadata size**:
   ```bash
   ls -lh .prisma/tenant-guard/meta.json
   ```

2. **Implement client cleanup**:
   ```typescript
   // Clean up tenant clients periodically
   setInterval(() => {
     if (tenantClients.size > 1000) {
       tenantClients.clear();
     }
   }, 300000); // 5 minutes
   ```

3. **Use weak references**:
   ```typescript
   const tenantClients = new WeakMap();
   ```

## Development Issues

### Auto-injection Not Working

**Problem**: Expected auto-injection doesn't occur in assist mode

**Symptoms**:
- Still getting missing tenant field errors
- No warning logs
- Inconsistent behavior

**Causes**:
- Using strict mode instead of assist
- Configuration errors
- Schema issues

**Solutions**:

1. **Verify mode setting**:
   ```typescript
   // Ensure using assist mode
   const tenantDb = withTenantGuard(prisma, tenantId, 'assist');
   ```

2. **Check warning handler**:
   ```typescript
   const tenantDb = withTenantGuard(prisma, tenantId, {
     mode: 'assist',
     meta: tenantMeta,
     onWarn: (warning) => {
       console.log('AuthzKit Warning:', warning); // Should show auto-injections
     }
   });
   ```

3. **Verify metadata includes model**:
   ```typescript
   console.log('Metadata:', Object.keys(tenantMeta));
   ```

### TypeScript Errors

**Problem**: TypeScript compilation errors with AuthzKit

**Symptoms**:
- Type errors in IDE
- Build failures
- Import issues

**Solutions**:

1. **Update TypeScript config**:
   ```json
   {
     "compilerOptions": {
       "moduleResolution": "node",
       "esModuleInterop": true,
       "resolveJsonModule": true
     }
   }
   ```

2. **Use type assertions if needed**:
   ```typescript
   const tenantMeta = require('../.prisma/tenant-guard/meta.json') as TenantMeta;
   ```

3. **Check generated types**:
   ```bash
   cat .prisma/tenant-guard/meta.ts
   ```

## Debugging Tips

### Enable Verbose Logging

```typescript
const tenantDb = withTenantGuard(prisma, tenantId, {
  mode: 'assist',
  meta: tenantMeta,
  onWarn: (warning) => {
    console.log(`🔧 AuthzKit ${warning.code}: ${warning.model}.${warning.operation} at ${warning.path}`);
  },
  onError: (error) => {
    console.error(`❌ AuthzKit Error: ${error.code} - ${error.message}`);
    console.error('Stack:', error.stack);
  }
});
```

### Inspect Metadata

```typescript
// Check what models are protected
console.log('Protected models:', Object.keys(tenantMeta));

// Check specific model configuration
console.log('User config:', tenantMeta.User);
```

### Test Tenant Isolation

```typescript
// Quick isolation test
const test = async () => {
  const tenant1Db = withTenantGuard(prisma, 'tenant-1');
  const tenant2Db = withTenantGuard(prisma, 'tenant-2');

  const user1 = await tenant1Db.user.create({
    data: { tenantId: 'tenant-1', email: 'test@example.com', name: 'Test' }
  });

  const crossTenantAccess = await tenant2Db.user.findUnique({
    where: { id: user1.id }
  });

  console.log('Cross-tenant access result:', crossTenantAccess); // Should be null
};
```

### Check Database State

```sql
-- Verify tenant data separation
SELECT tenantId, COUNT(*) FROM "User" GROUP BY tenantId;

-- Check foreign key constraints
SELECT tc.constraint_name, tc.table_name, kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY';
```

## Getting Help

### Community Resources

- **GitHub Issues**: Report bugs and get community help
- **Discord**: Real-time support from the community
- **Documentation**: Comprehensive guides and examples

### Debugging Information to Include

When reporting issues, include:

1. **AuthzKit version**: `npm list @authzkit/prisma-tenant-guard`
2. **Prisma version**: `npx prisma --version`
3. **Node.js version**: `node --version`
4. **Minimal reproduction**: Code that reproduces the issue
5. **Error messages**: Complete error output
6. **Schema**: Relevant parts of your Prisma schema
7. **Configuration**: AuthzKit configuration being used

### Minimal Reproduction Template

```typescript
// minimal-repro.ts
import { PrismaClient } from '@prisma/client';
import { withTenantGuard } from '@authzkit/prisma-tenant-guard';
import tenantMeta from './.prisma/tenant-guard/meta.json';

const prisma = new PrismaClient();

async function reproduce() {
  const tenantDb = withTenantGuard(prisma, 'test-tenant', {
    mode: 'assist',
    meta: tenantMeta
  });

  // Add code that reproduces the issue
  try {
    const result = await tenantDb.user.create({
      data: {
        email: 'test@example.com',
        name: 'Test User'
      }
    });
    console.log('Success:', result);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

reproduce();
```

---

**Next: [Best Practices](/tenant-guard/best-practices)** - Learn production-tested deployment strategies.