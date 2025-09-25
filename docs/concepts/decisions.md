---
title: Decisions & Attributes
outline: deep
---

# Decisions & Attributes

When you check a policy, AuthzKit returns a rich **Decision** object containing not just whether access is allowed, but also detailed context about why and how the decision was made.

## Decision Objects

A **Decision** is the result of evaluating a policy against an action request. It contains everything you need to enforce authorization and apply business logic.

```typescript
const decision = policy.checkDetailed('viewPost', {
  subject: user,
  resource: post
})

// Decision structure:
{
  allow: boolean,           // Was access granted?
  reason: string,           // Why was this decision made?
  readMask?: FieldMask,     // Which fields can be read
  writeMask?: FieldMask,    // Which fields can be written
  attrs?: Record<string, any> // Additional context
}
```

## Decision Properties

### allow
Indicates whether the action is permitted:

```typescript
if (!decision.allow) {
  throw new Error(`Access denied: ${decision.reason}`)
}

// Proceed with the action
```

### reason
Human-readable explanation for the decision:

```typescript
const decision = policy.checkDetailed('editPost', {
  subject: { role: 'user', status: 'suspended' },
  resource: post
})

console.log(decision.reason) // "account-suspended"
```

Use reasons for:
- Error messages to users
- Audit logging
- Debugging authorization issues
- Analytics on access patterns

### readMask & writeMask
Field-level permissions (covered in detail in [Field-Level Permissions](/concepts/field-permissions)):

```typescript
const decision = policy.checkDetailed('viewUser', {
  subject: { role: 'user' },
  resource: targetUser
})

// Apply read mask to filter response
const filteredUser = applyReadMask(targetUser, decision.readMask)
```

### attrs (Attributes)
Additional context returned by rules to influence how actions are performed:

```typescript
const decision = policy.checkDetailed('listPosts', {
  subject: { role: 'user', tenantId: 't1' },
  resource: {} // Not used for list operations
})

console.log(decision.attrs)
// {
//   tenantId: 't1',
//   publishedOnly: true,
//   maxResults: 100
// }
```

## Attributes in Detail

**Attributes** are the most powerful feature of AuthzKit decisions. They allow rules to return additional context that your application can use to modify behavior.

### Defining Attributes in Rules

Rules can return attributes through their `when` function:

```typescript
{
  id: 'user-tenant-scoped',
  action: 'listPosts',
  effect: 'allow',
  when: ({ subject }) => ({
    matches: subject.role === 'user',
    attrs: {
      tenantId: subject.tenantId,     // Filter by tenant
      publishedOnly: true,            // Only published posts
      maxResults: 100,                // Limit result size
      sortBy: 'createdAt',            // Default sorting
      includeStats: false             // Don't include statistics
    }
  }),
  reason: 'user-access'
}
```

### Common Attribute Use Cases

#### 1. Query Filtering
The most common use of attributes is to filter database queries:

```typescript
// Rule returns filtering attributes
{
  id: 'user-own-tenant-posts',
  action: 'listPosts',
  effect: 'allow',
  when: ({ subject }) => ({
    matches: subject.role === 'user',
    attrs: {
      tenantId: subject.tenantId,
      publishedOnly: true,
      authorId: subject.id  // Only user's own posts
    }
  }),
  reason: 'user-own-posts'
}

// Use attributes to build database query
function buildPostQuery(decision: Decision) {
  let query = db.select().from(posts)

  if (decision.attrs?.tenantId) {
    query = query.where(eq(posts.tenantId, decision.attrs.tenantId))
  }

  if (decision.attrs?.publishedOnly) {
    query = query.where(eq(posts.published, true))
  }

  if (decision.attrs?.authorId) {
    query = query.where(eq(posts.authorId, decision.attrs.authorId))
  }

  return query
}
```

#### 2. Business Rules
Attributes can enforce business logic and constraints:

```typescript
{
  id: 'trial-user-limits',
  action: 'createPost',
  effect: 'allow',
  when: ({ subject }) => ({
    matches: subject.plan === 'trial',
    attrs: {
      maxPostsPerMonth: 3,
      requireApproval: true,
      restrictedCategories: ['premium', 'enterprise']
    }
  }),
  reason: 'trial-user'
}

// Use attributes to enforce business rules
function validatePostCreation(postData: any, decision: Decision) {
  const attrs = decision.attrs

  if (attrs?.requireApproval) {
    postData.status = 'pending_approval'
  }

  if (attrs?.restrictedCategories?.includes(postData.category)) {
    throw new Error(`Category '${postData.category}' not available on your plan`)
  }

  return postData
}
```

#### 3. Feature Flags
Control feature availability per user:

```typescript
{
  id: 'premium-user-features',
  action: 'accessFeature',
  effect: 'allow',
  when: ({ subject, resource }) => ({
    matches: subject.plan === 'premium',
    attrs: {
      enableAdvancedEditor: true,
      enableAnalytics: true,
      enableCustomThemes: true,
      enablePrioritySupport: true
    }
  }),
  reason: 'premium-features'
}

// Use attributes for feature flags
function renderEditor(user: User, decision: Decision) {
  if (decision.attrs?.enableAdvancedEditor) {
    return <AdvancedEditor />
  } else {
    return <BasicEditor />
  }
}
```

#### 4. Rate Limiting
Enforce different limits based on user type:

```typescript
{
  id: 'api-rate-limits',
  action: 'makeApiCall',
  effect: 'allow',
  when: ({ subject }) => ({
    matches: true,  // Allow all, but with different limits
    attrs: {
      requestsPerMinute: subject.plan === 'premium' ? 1000 : 100,
      requestsPerDay: subject.plan === 'premium' ? 50000 : 5000,
      burstLimit: subject.plan === 'premium' ? 50 : 10
    }
  }),
  reason: 'api-access'
}
```

## Working with Decisions

### Basic Decision Handling

```typescript
async function handlePostView(userId: string, postId: string) {
  const user = await getUser(userId)
  const post = await getPost(postId)

  const decision = policy.checkDetailed('viewPost', {
    subject: user,
    resource: post
  })

  if (!decision.allow) {
    throw new Error(decision.reason)
  }

  // Apply read mask to filter fields
  const filteredPost = applyReadMask(post, decision.readMask)

  return filteredPost
}
```

### Using Attributes for Query Building

```typescript
async function listPosts(user: User, filters: any = {}) {
  const decision = policy.checkDetailed('listPosts', {
    subject: user,
    resource: {} // Not needed for list operations
  })

  if (!decision.allow) {
    throw new Error(decision.reason)
  }

  // Build query using decision attributes
  let query = db.select().from(posts)

  // Apply policy-driven filters
  if (decision.attrs?.tenantId) {
    query = query.where(eq(posts.tenantId, decision.attrs.tenantId))
  }

  if (decision.attrs?.publishedOnly) {
    query = query.where(eq(posts.published, true))
  }

  if (decision.attrs?.authorId) {
    query = query.where(eq(posts.authorId, decision.attrs.authorId))
  }

  // Apply user-provided filters (secondary)
  if (filters.category) {
    query = query.where(eq(posts.category, filters.category))
  }

  // Apply policy-driven limits
  if (decision.attrs?.maxResults) {
    query = query.limit(decision.attrs.maxResults)
  }

  const results = await query

  // Apply read mask to each result
  return results.map(post => applyReadMask(post, decision.readMask))
}
```

### Complex Decision Logic

```typescript
async function handleFileDownload(user: User, fileId: string, context: any) {
  const file = await getFile(fileId)

  const decision = policy.checkDetailed('downloadFile', {
    subject: user,
    resource: file,
    context
  })

  if (!decision.allow) {
    throw new Error(decision.reason)
  }

  // Apply business rules from attributes
  const attrs = decision.attrs

  // Check rate limits
  if (attrs?.maxDownloadsPerDay) {
    const todayDownloads = await getUserDownloadsToday(user.id)
    if (todayDownloads >= attrs.maxDownloadsPerDay) {
      throw new Error('Daily download limit exceeded')
    }
  }

  // Apply file size restrictions
  if (attrs?.maxFileSizeMB && file.sizeMB > attrs.maxFileSizeMB) {
    throw new Error(`File too large. Maximum size: ${attrs.maxFileSizeMB}MB`)
  }

  // Generate appropriate download URL
  const downloadUrl = attrs?.requireWatermark
    ? generateWatermarkedUrl(file)
    : generateDirectUrl(file)

  // Log download with context from attributes
  await logDownload({
    userId: user.id,
    fileId: file.id,
    reason: decision.reason,
    restrictions: attrs
  })

  return { downloadUrl, expiresAt: attrs?.linkExpiryHours }
}
```

## Attribute Patterns

### 1. Hierarchical Attributes

Organize attributes hierarchically for complex scenarios:

```typescript
{
  id: 'enterprise-user-access',
  action: 'accessWorkspace',
  effect: 'allow',
  when: ({ subject }) => ({
    matches: subject.plan === 'enterprise',
    attrs: {
      permissions: {
        read: ['all'],
        write: ['own', 'team'],
        delete: ['own']
      },
      limits: {
        storage: '1TB',
        apiCalls: 100000,
        seats: 50
      },
      features: {
        analytics: true,
        customBranding: true,
        ssoIntegration: true
      }
    }
  }),
  reason: 'enterprise-access'
}
```

### 2. Conditional Attributes

Attributes can vary based on context:

```typescript
{
  id: 'time-based-access',
  action: 'accessResource',
  effect: 'allow',
  when: ({ subject, context }) => {
    const now = new Date()
    const isBusinessHours = now.getHours() >= 9 && now.getHours() < 17

    return {
      matches: subject.role === 'employee',
      attrs: {
        accessLevel: isBusinessHours ? 'full' : 'limited',
        auditRequired: !isBusinessHours,
        maxSessionDuration: isBusinessHours ? 8 * 60 : 2 * 60, // minutes
      }
    }
  },
  reason: 'time-based-access'
}
```

### 3. Computed Attributes

Generate attributes dynamically based on user state:

```typescript
{
  id: 'dynamic-user-limits',
  action: 'performAction',
  effect: 'allow',
  when: ({ subject }) => {
    // Calculate user's trust score
    const trustScore = calculateTrustScore(subject)

    return {
      matches: trustScore > 0.5,
      attrs: {
        trustScore,
        verificationRequired: trustScore < 0.8,
        additionalChecks: trustScore < 0.6,
        allowedOperations: trustScore > 0.9 ? 'all' : 'basic'
      }
    }
  },
  reason: 'trust-based-access'
}
```

## Testing Decisions

Test both the decision outcome and the attributes:

```typescript
describe('Post Policy Decisions', () => {
  it('returns correct attributes for user access', () => {
    const decision = policy.checkDetailed('listPosts', {
      subject: { role: 'user', tenantId: 't1' },
      resource: {}
    })

    expect(decision.allow).toBe(true)
    expect(decision.reason).toBe('user-access')
    expect(decision.attrs).toEqual({
      tenantId: 't1',
      publishedOnly: true,
      maxResults: 100
    })
  })

  it('includes proper read mask for moderators', () => {
    const decision = policy.checkDetailed('viewPost', {
      subject: { role: 'moderator', tenantId: 't1' },
      resource: { tenantId: 't1' }
    })

    expect(decision.readMask).toEqual({
      id: true,
      title: true,
      content: true,
      published: true,
      authorId: true,
      // tenantId excluded for security
    })
  })

  it('denies access with correct reason', () => {
    const decision = policy.checkDetailed('deletePost', {
      subject: { role: 'user', status: 'suspended' },
      resource: { authorId: 'user' }
    })

    expect(decision.allow).toBe(false)
    expect(decision.reason).toBe('account-suspended')
    expect(decision.attrs).toBeUndefined()
  })
})
```

## Best Practices

### 1. Use Descriptive Attribute Names

Make attribute purposes clear:

```typescript
// ✅ Clear attribute names
attrs: {
  maxResultsPerPage: 50,
  includePrivateFields: false,
  requireEmailVerification: true
}

// ❌ Unclear attribute names
attrs: {
  limit: 50,
  private: false,
  verify: true
}
```

### 2. Validate Attribute Usage

Ensure your application correctly handles all possible attributes:

```typescript
function applyPolicyAttributes(query: any, attrs: any) {
  // Handle known attributes
  if (attrs?.tenantId) {
    query = query.where('tenantId', attrs.tenantId)
  }

  // Warn about unknown attributes (helps catch typos)
  const knownAttrs = ['tenantId', 'publishedOnly', 'maxResults']
  const unknownAttrs = Object.keys(attrs || {}).filter(
    key => !knownAttrs.includes(key)
  )

  if (unknownAttrs.length > 0) {
    console.warn('Unknown policy attributes:', unknownAttrs)
  }

  return query
}
```

### 3. Document Attribute Contracts

Clearly document what attributes your rules return:

```typescript
/**
 * User access rule for listing posts
 *
 * Returns attributes:
 * - tenantId: string - Filter posts by user's tenant
 * - publishedOnly: boolean - Only show published posts
 * - maxResults: number - Limit number of results
 * - sortBy: string - Default sort field
 */
{
  id: 'user-list-posts',
  // ...
}
```

### 4. Handle Missing Attributes Gracefully

Always provide sensible defaults:

```typescript
function buildQuery(decision: Decision) {
  const attrs = decision.attrs || {}

  return db.select()
    .from(posts)
    .where(eq(posts.tenantId, attrs.tenantId || 'default'))
    .limit(attrs.maxResults || 10)  // Sensible default
    .orderBy(attrs.sortBy || 'createdAt')
}
```

## Next Steps

- Learn about [Type Safety](/concepts/type-safety) for TypeScript integration
- Explore [Integration Examples](/examples/) to see decisions in real applications
- Check out the [Getting Started](/guides/getting-started) guide to implement AuthzKit