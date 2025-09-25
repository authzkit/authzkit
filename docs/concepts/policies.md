---
title: Policies & Rules
outline: deep
---

# Policies & Rules

Policies are the heart of AuthzKit - they encapsulate all your authorization logic in one place using declarative rules.

## What is a Policy?

A **Policy** is a collection of rules that define what actions are allowed or denied in your application. Policies centralize authorization logic and make it easy to reason about, test, and modify.

```typescript
export const policy = definePolicy<Actions>({
  byAction: {
    viewPost: [
      {
        id: 'admin-full-access',
        effect: 'allow',
        when: ({ subject }) => subject.role === 'admin',
        reason: 'admin-privilege'
      },
      {
        id: 'deny-suspended',
        effect: 'deny',
        when: ({ subject }) => subject.status === 'suspended',
        reason: 'account-suspended'
      }
    ]
  }
})
```

## Anatomy of a Rule

Each rule is an object that defines when an action should be allowed or denied:

```typescript
{
  id: 'user-edit-own-posts',           // Unique identifier
  action: 'editPost',                  // Which action this applies to
  effect: 'allow',                     // 'allow' or 'deny'
  when: ({ subject, resource }) => ({  // Condition function
    matches: subject.id === resource.authorId,
    attrs: { requireOwnership: true }
  }),
  readMask: { /* ... */ },             // Optional: fields user can read
  writeMask: { /* ... */ },            // Optional: fields user can write
  reason: 'post-owner'                 // Human-readable explanation
}
```

### Rule Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | ✅ | Unique identifier for debugging and auditing |
| `action` | `string` | ✅ | The action this rule applies to |
| `effect` | `'allow' \| 'deny'` | ✅ | Whether this rule grants or denies access |
| `when` | `function` | ✅ | Condition that determines if the rule applies |
| `reason` | `string` | ✅ | Human-readable explanation for the decision |
| `readMask` | `FieldMask` | ❌ | Fields the subject can read (allow rules only) |
| `writeMask` | `FieldMask` | ❌ | Fields the subject can modify (allow rules only) |

## Rule Evaluation Order

Rules are evaluated in a specific order to ensure predictable behavior:

### 1. Deny Rules First
If **any** deny rule matches, access is immediately denied, regardless of allow rules.

```typescript
const policy = definePolicy<Actions>({
  byAction: {
    viewPost: [
    // This deny rule will block access even if allow rules match
    {
      id: 'deny-suspended',
      effect: 'deny',
      when: ({ subject }) => subject.status === 'suspended',
      reason: 'account-suspended'
    },

    // This allow rule won't help suspended users
    {
      id: 'allow-admin',
      effect: 'allow',
      when: ({ subject }) => subject.role === 'admin',
      reason: 'admin-access'
    }
    ]
  }
})
```

### 2. First Matching Allow Rule Wins
Among allow rules, the **first** matching rule determines the decision.

```typescript
const policy = definePolicy<Actions>({
  byAction: {
    viewPost: [
    // This rule will match first for admins
    {
      id: 'admin-full-access',
      effect: 'allow',
      when: ({ subject }) => subject.role === 'admin',
      readMask: { id: true, title: true, content: true, authorId: true },
      reason: 'admin-access'
    },

    // This rule will never be reached for admins
    {
      id: 'admin-limited',
      effect: 'allow',
      when: ({ subject }) => subject.role === 'admin',
      readMask: { id: true, title: true }, // More restrictive
      reason: 'admin-limited'
    }
    ]
  }
})
```

### 3. Default Deny
If no rules match, access is **denied by default**.

```typescript
// User with role 'guest' - no matching rules = deny
const decision = policy.checkDetailed('viewPost', {
  subject: { role: 'guest' },
  resource: { authorId: 'someone' }
})

console.log(decision.allow) // false
console.log(decision.reason) // 'no-matching-rule' or similar
```

## Condition Functions

The `when` property accepts a function that determines if a rule applies. It receives the full action context:

```typescript
when: ({ subject, resource, changes, context }) => {
  // Simple boolean condition
  return subject.role === 'admin'
}

when: ({ subject, resource }) => {
  // Condition with attributes
  return {
    matches: subject.tenantId === resource.tenantId,
    attrs: {
      tenantId: subject.tenantId,
      publishedOnly: true
    }
  }
}
```

### Available Context

| Parameter | Description | Always Available |
|-----------|-------------|------------------|
| `subject` | The user/entity performing the action | ✅ |
| `resource` | The resource being accessed | ✅ |
| `changes` | Data being modified (for write actions) | ❌ |
| `context` | Additional request context | ❌ |

## Rule Organization Strategies

### 1. Security-First Ordering

Place security rules (denies) at the top:

```typescript
const policy = definePolicy<Actions>({
  byAction: {
    viewPost: [
    // Security guardrails first
    { effect: 'deny', when: ({ subject }) => subject.status === 'suspended' },
    { effect: 'deny', when: ({ subject }) => !subject.emailVerified },
    { effect: 'deny', when: ({ subject }) => subject.loginAttempts > 5 },

    // Then permission grants
    { effect: 'allow', when: ({ subject }) => subject.role === 'admin' },
    { effect: 'allow', when: ({ subject, resource }) => subject.id === resource.authorId },
    ]
  }
})
```

### 2. Role-Based Grouping

Group rules by role for clarity:

```typescript
const policy = definePolicy<Actions>({
  byAction: {
    viewPost: [
    // Admin rules
    {
      id: 'admin-view-all',
      effect: 'allow',
      when: ({ subject }) => subject.role === 'admin',
      readMask: { /* all fields */ },
      reason: 'admin-access'
    },

    // Moderator rules
    {
      id: 'moderator-view-tenant',
      effect: 'allow',
      when: ({ subject, resource }) =>
        subject.role === 'moderator' && subject.tenantId === resource.tenantId,
      readMask: { /* most fields */ },
      reason: 'moderator-access'
    },

    // User rules
    {
      id: 'user-view-published',
      effect: 'allow',
      when: ({ subject, resource }) => ({
        matches: subject.role === 'user' && resource.published,
        attrs: { publishedOnly: true }
      }),
      readMask: { /* limited fields */ },
      reason: 'user-access'
    }
    ]
  }
})
```

### 3. Action-Specific Files

Split large policies across multiple files:

```typescript
// policies/posts.ts
export const postRules = [
  { action: 'viewPost', /* ... */ },
  { action: 'editPost', /* ... */ },
  { action: 'deletePost', /* ... */ }
]

// policies/users.ts
export const userRules = [
  { action: 'viewUser', /* ... */ },
  { action: 'editUser', /* ... */ }
]

// policies/index.ts
export const policy = definePolicy<Actions>({
  rules: [
    ...postRules,
    ...userRules
  ]
})
```

## Testing Policies

Write focused tests for each rule:

```typescript
describe('Post Policy', () => {
  describe('viewPost action', () => {
    it('allows admin to view any post', () => {
      const decision = policy.checkDetailed('viewPost', {
        subject: { role: 'admin', status: 'active' },
        resource: { authorId: 'other-user', published: false }
      })

      expect(decision.allow).toBe(true)
      expect(decision.reason).toBe('admin-access')
    })

    it('denies suspended users', () => {
      const decision = policy.checkDetailed('viewPost', {
        subject: { role: 'admin', status: 'suspended' },
        resource: { authorId: 'user', published: true }
      })

      expect(decision.allow).toBe(false)
      expect(decision.reason).toBe('account-suspended')
    })

    it('allows users to view published posts in their tenant', () => {
      const decision = policy.checkDetailed('viewPost', {
        subject: { role: 'user', tenantId: 't1' },
        resource: { tenantId: 't1', published: true }
      })

      expect(decision.allow).toBe(true)
      expect(decision.attrs?.publishedOnly).toBe(true)
    })
  })
})
```

## Best Practices

### 1. Use Descriptive Rule IDs

Rule IDs help with debugging, auditing, and understanding policy decisions:

```typescript
// ✅ Good - clear intent
{ id: 'admin-full-access' }
{ id: 'user-own-content-edit' }
{ id: 'deny-suspended-accounts' }

// ❌ Bad - not descriptive
{ id: 'rule-1' }
{ id: 'check-2' }
{ id: 'policy-a' }
```

### 2. Write Positive Conditions

Express what should be allowed rather than what should be denied:

```typescript
// ✅ Positive condition - easier to understand
when: ({ subject }) => subject.role === 'admin'

// ❌ Negative condition - harder to reason about
when: ({ subject }) => subject.role !== 'user' && subject.role !== 'guest'
```

### 3. Keep Rules Focused

Each rule should have a single, clear purpose:

```typescript
// ✅ Focused rule
{
  id: 'user-edit-own-profile',
  when: ({ subject, resource }) => subject.id === resource.id,
  writeMask: { name: true, email: true }
}

// ❌ Complex rule doing multiple things
{
  id: 'user-complex-logic',
  when: ({ subject, resource }) =>
    (subject.id === resource.id && subject.emailVerified) ||
    (subject.role === 'moderator' && subject.tenantId === resource.tenantId) ||
    (subject.role === 'admin' && resource.published)
}
```

### 4. Document Complex Logic

Add comments for non-obvious business rules:

```typescript
{
  id: 'user-trial-limits',
  action: 'createPost',
  effect: 'deny',
  // Trial users can only create 3 posts per month
  when: ({ subject, context }) =>
    subject.plan === 'trial' && context.userPostCount >= 3,
  reason: 'trial-limit-exceeded'
}
```

## Next Steps

- Learn about [Actions](/concepts/actions) to understand how to define what users can do
- Explore [Field-Level Permissions](/concepts/field-permissions) for granular data control
- See [Decisions & Attributes](/concepts/decisions) to understand policy results
