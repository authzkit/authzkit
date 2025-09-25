---
title: Field-Level Permissions
outline: deep
---

# Field-Level Permissions

AuthzKit provides fine-grained control over data access through field-level permissions. Use **read masks** to control what data users can see and **write masks** to control what they can modify.

## Overview

Field-level permissions solve a common problem: different users should see different parts of the same data. Instead of creating multiple API endpoints or complex filtering logic, AuthzKit lets you define data access rules declaratively.

```typescript
// Without field-level permissions
if (user.role === 'admin') {
  return { id, title, content, authorId, email, phone }  // All fields
} else if (user.role === 'user') {
  return { id, title, content }  // Limited fields
} else {
  return { id, title }  // Even more limited
}

// With AuthzKit field-level permissions
const decision = policy.checkDetailed('viewUser', { subject: user, resource: targetUser })
return applyReadMask(targetUser, decision.readMask)  // Automatic filtering
```

## Read Masks

A **read mask** specifies which fields a subject can view when accessing a resource. Fields not included in the mask are filtered out from responses.

### Basic Read Mask

```typescript
{
  id: 'user-view-public-profile',
  action: 'viewUser',
  effect: 'allow',
  when: ({ subject }) => subject.role === 'user',
  readMask: {
    id: true,           // ✅ Can view
    name: true,         // ✅ Can view
    email: true,        // ✅ Can view
    bio: true,          // ✅ Can view
    // phone: false,    // ❌ Cannot view (omitted)
    // ssn: false,      // ❌ Cannot view (omitted)
  } satisfies FieldMask<User>,
  reason: 'public-profile'
}
```

### Conditional Read Masks

Different roles can have different read permissions for the same action:

```typescript
const policy = definePolicy<Actions>({
  byAction: {
    viewUser: [
    // Admins see everything
    {
      id: 'admin-view-user-full',
      effect: 'allow',
      when: ({ subject }) => subject.role === 'admin',
      readMask: {
        id: true,
        name: true,
        email: true,
        phone: true,
        ssn: true,           // ✅ Admin can see sensitive data
        createdAt: true,
        lastLogin: true,
      },
      reason: 'admin-access'
    },

    // Users see limited profile
    {
      id: 'user-view-user-limited',
      effect: 'allow',
      when: ({ subject, resource }) =>
        subject.role === 'user' && subject.id === resource.id,
      readMask: {
        id: true,
        name: true,
        email: true,
        // phone: false,     // ❌ Users can't see their own phone in this view
        // ssn: false,       // ❌ No sensitive data
      },
      reason: 'own-profile'
    },

    // Guests see minimal info
    {
      id: 'guest-view-user-minimal',
      effect: 'allow',
      when: ({ subject }) => subject.role === 'guest',
      readMask: {
        id: true,
        name: true,
        // Everything else hidden
      },
      reason: 'guest-access'
    }
  ]
  }
})
```

### Read Mask Usage

Apply read masks to filter API responses:

```typescript
// API endpoint
app.get('/api/users/:id', async (req, res) => {
  const user = await getUser(req.params.id)

  const decision = policy.checkDetailed('viewUser', {
    subject: req.user,
    resource: user
  })

  if (!decision.allow) {
    return res.status(403).json({ error: decision.reason })
  }

  // Apply read mask to filter fields
  const filteredUser = applyReadMask(user, decision.readMask)
  res.json(filteredUser)
})

// Helper function to apply read mask
function applyReadMask<T>(data: T, mask?: FieldMask<T>): Partial<T> {
  if (!mask) return data

  const result: Partial<T> = {}
  for (const [key, allowed] of Object.entries(mask)) {
    if (allowed && key in data) {
      result[key as keyof T] = data[key as keyof T]
    }
  }
  return result
}
```

## Write Masks

A **write mask** specifies which fields a subject can modify when updating a resource. This prevents unauthorized field modifications and privilege escalation.

### Basic Write Mask

```typescript
{
  id: 'user-edit-own-profile',
  action: 'editUser',
  effect: 'allow',
  when: ({ subject, resource }) => subject.id === resource.id,
  writeMask: {
    name: true,         // ✅ Can edit
    email: true,        // ✅ Can edit
    bio: true,          // ✅ Can edit
    // role: false,     // ❌ Cannot edit (prevents privilege escalation)
    // id: false,       // ❌ Cannot edit (immutable)
    // createdAt: false // ❌ Cannot edit (system field)
  } satisfies FieldMask<User>,
  reason: 'own-profile'
}
```

### Role-Based Write Permissions

Different roles have different write capabilities:

```typescript
const policy = definePolicy<Actions>({
  byAction: {
    editUser: [
    // Admins can edit most fields
    {
      id: 'admin-edit-user',
      effect: 'allow',
      when: ({ subject }) => subject.role === 'admin',
      writeMask: {
        name: true,
        email: true,
        role: true,         // ✅ Admins can change roles
        status: true,       // ✅ Admins can activate/deactivate
        // id: false,       // ❌ Still can't edit ID
      },
      reason: 'admin-edit'
    },

    // Users can only edit their own basic info
    {
      id: 'user-edit-own',
      effect: 'allow',
      when: ({ subject, resource }) => subject.id === resource.id,
      writeMask: {
        name: true,
        email: true,
        bio: true,
        // role: false,     // ❌ Users can't change their role
        // status: false,   // ❌ Users can't change their status
      },
      reason: 'self-edit'
    },

    // Moderators can edit users in their tenant
    {
      id: 'moderator-edit-tenant-user',
      effect: 'allow',
      when: ({ subject, resource }) =>
        subject.role === 'moderator' && subject.tenantId === resource.tenantId,
      writeMask: {
        name: true,
        email: true,
        status: true,       // ✅ Moderators can suspend users
        // role: false,     // ❌ But can't change roles
      },
      reason: 'moderator-edit'
    }
    ]
  }
})
```

### Write Mask Validation

Enforce write masks in your API endpoints:

```typescript
app.put('/api/users/:id', async (req, res) => {
  const user = await getUser(req.params.id)
  const changes = req.body

  const decision = policy.checkDetailed('editUser', {
    subject: req.user,
    resource: user,
    changes
  })

  if (!decision.allow) {
    return res.status(403).json({ error: decision.reason })
  }

  // Validate changes against write mask
  const allowedChanges = applyWriteMask(changes, decision.writeMask)

  // Check if user tried to modify forbidden fields
  const forbiddenFields = Object.keys(changes).filter(
    key => !decision.writeMask?.[key]
  )

  if (forbiddenFields.length > 0) {
    return res.status(403).json({
      error: 'Cannot modify fields: ' + forbiddenFields.join(', ')
    })
  }

  // Apply allowed changes
  const updatedUser = await updateUser(req.params.id, allowedChanges)
  res.json(updatedUser)
})
```

## Advanced Patterns

### Conditional Field Access

Field access can depend on the specific resource or context:

```typescript
{
  id: 'user-view-own-sensitive',
  action: 'viewUser',
  effect: 'allow',
  when: ({ subject, resource }) => ({
    matches: subject.id === resource.id,
    // Only show phone if user has verified their email
    attrs: { showSensitive: subject.emailVerified }
  }),
  readMask: ({ attrs }) => ({
    id: true,
    name: true,
    email: true,
    phone: attrs?.showSensitive,  // Conditional field access
    ssn: false,
  }),
  reason: 'own-profile-conditional'
}
```

### Computed Fields

Include derived or computed fields in masks:

```typescript
{
  id: 'admin-view-user-with-stats',
  action: 'viewUser',
  effect: 'allow',
  when: ({ subject }) => subject.role === 'admin',
  readMask: {
    // Standard fields
    id: true,
    name: true,
    email: true,

    // Computed fields (added by your API layer)
    postCount: true,
    lastActiveDate: true,
    reputationScore: true,
  },
  reason: 'admin-detailed-view'
}
```

### Nested Object Masks

Handle complex nested objects:

```typescript
type User = {
  id: string
  name: string
  profile: {
    bio: string
    avatar: string
    social: {
      twitter?: string
      linkedin?: string
    }
  }
  settings: {
    emailNotifications: boolean
    privateProfile: boolean
  }
}

// Nested field masks
{
  id: 'user-view-profile',
  action: 'viewUser',
  effect: 'allow',
  when: ({ subject }) => subject.role === 'user',
  readMask: {
    id: true,
    name: true,
    profile: {
      bio: true,
      avatar: true,
      social: {
        twitter: true,
        // linkedin: false  // Hidden for privacy
      }
    },
    // settings: false  // Entire settings object hidden
  },
  reason: 'public-profile'
}
```

## Database Integration

AuthzKit does not ship ORM-specific “select” or “where” builders. Apply read masks in your serialization layer (see applyReadMask above), and handcraft ORM selects/filters as needed for your data model.

Example flow:

```ts
const decision = policy.checkDetailed('viewUser', { subject, resource })
const user = await prisma.user.findUnique({ where: { id } })
const safeUser = applyReadMask(user, decision.readMask)
```

## Security Considerations

### 1. Default Deny for Sensitive Fields

Always be explicit about sensitive field access:

```typescript
// ✅ Explicit about sensitive fields
readMask: {
  id: true,
  name: true,
  email: true,
  // Explicitly omit sensitive fields
  // ssn: false,
  // creditCard: false,
}

// ❌ Risky - might accidentally expose sensitive data
readMask: {
  ...allFields,  // Could include sensitive fields
  ssn: false,    // Trying to remove after the fact
}
```

### 2. Validate Write Mask Compliance

Always check that incoming changes comply with write masks:

```typescript
function validateWriteMask<T>(
  changes: Partial<T>,
  writeMask?: FieldMask<T>
): string[] {
  if (!writeMask) return []  // No restrictions

  const violations: string[] = []
  for (const field of Object.keys(changes)) {
    if (!writeMask[field as keyof T]) {
      violations.push(field)
    }
  }
  return violations
}

// Use before applying changes
const violations = validateWriteMask(req.body, decision.writeMask)
if (violations.length > 0) {
  throw new Error(`Cannot modify: ${violations.join(', ')}`)
}
```

### 3. Audit Field Access

Log when sensitive fields are accessed:

```typescript
function applyReadMaskWithAudit<T>(
  data: T,
  mask: FieldMask<T>,
  context: { userId: string; action: string }
) {
  const result = applyReadMask(data, mask)

  // Log access to sensitive fields
  const sensitiveFields = ['ssn', 'creditCard', 'password']
  const accessedSensitive = Object.keys(mask)
    .filter(field => mask[field] && sensitiveFields.includes(field))

  if (accessedSensitive.length > 0) {
    auditLog.info('Sensitive field access', {
      userId: context.userId,
      action: context.action,
      fields: accessedSensitive,
      timestamp: new Date()
    })
  }

  return result
}
```

## Testing Field Permissions

Test your field-level permissions thoroughly:

```typescript
describe('User Field Permissions', () => {
  describe('Read Masks', () => {
    it('allows admin to see all fields', () => {
      const decision = policy.checkDetailed('viewUser', {
        subject: { role: 'admin' },
        resource: mockUser
      })

      expect(decision.readMask).toEqual({
        id: true,
        name: true,
        email: true,
        phone: true,
        ssn: true,
      })
    })

    it('restricts user to public fields only', () => {
      const decision = policy.checkDetailed('viewUser', {
        subject: { role: 'user' },
        resource: mockUser
      })

      expect(decision.readMask).toEqual({
        id: true,
        name: true,
        email: true,
        // phone and ssn should be omitted
      })
    })
  })

  describe('Write Masks', () => {
    it('prevents users from editing their role', () => {
      const decision = policy.checkDetailed('editUser', {
        subject: mockUser,
        resource: mockUser,
        changes: { role: 'admin' }
      })

      expect(decision.writeMask?.role).toBeFalsy()
    })
  })
})
```

## Best Practices

### 1. Be Explicit About Sensitive Fields

Always explicitly handle sensitive data in your masks:

```typescript
// ✅ Clear about what's included/excluded
readMask: {
  id: true,
  name: true,
  email: true,
  // Sensitive fields explicitly omitted
}
```

### 2. Use TypeScript for Field Safety

Leverage TypeScript to catch field mask errors:

```typescript
// TypeScript will error if field doesn't exist on User type
readMask: {
  id: true,
  invalidField: true,  // ❌ TypeScript error
} satisfies FieldMask<User>
```

### 3. Test Edge Cases

Test boundary conditions for field permissions:

```typescript
// Test with empty objects
// Test with null/undefined masks
// Test with conflicting permissions
// Test with deeply nested objects
```

### 4. Document Field Sensitivity

Clearly document which fields are considered sensitive:

```typescript
type User = {
  id: string           // Public
  name: string         // Public
  email: string        // Semi-private
  phone?: string       // Private
  ssn?: string         // Highly sensitive
  createdAt: Date      // System field
}
```

## Next Steps

- Learn about [Decisions & Attributes](/concepts/decisions) to understand policy results
- Explore [Type Safety](/concepts/type-safety) for more TypeScript integration details
- Check out the [Integration Examples](/examples/) to see field permissions in action
