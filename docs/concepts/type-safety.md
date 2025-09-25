---
title: Type Safety
outline: deep
---

# Type Safety

AuthzKit provides end-to-end type safety throughout your authorization flow, leveraging TypeScript's powerful type system to catch errors at compile time and provide excellent developer experience.

## Why Type Safety Matters

Type safety in authorization prevents common bugs and security issues:

```typescript
// Without type safety - prone to errors
policy.check('viewPost', {
  subject: user,
  // Missing required 'resource' field - runtime error
})

// With AuthzKit type safety - compile-time error
policy.check('viewPost', {
  subject: user,
  resource: post  // TypeScript enforces this is required
})
```

## Type-Safe Action Definitions

Actions define the exact shape of authorization requests:

```typescript
import { action, defineActions } from '@authzkit/core'

type User = {
  id: string
  role: 'admin' | 'user' | 'moderator'
  tenantId: string
}

type Post = {
  id: string
  title: string
  content: string
  authorId: string
  tenantId: string
  published: boolean
}

export const actions = defineActions({
  viewPost: action<{
    subject: User;
    resource: Post
  }>(),

  editPost: action<{
    subject: User;
    resource: Post;
    changes: Partial<Pick<Post, 'title' | 'content'>>  // Only these fields editable
  }>(),

  deletePost: action<{
    subject: User;
    resource: Post
  }>()
})

export type Actions = typeof actions
```

## Type-Safe Policy Rules

Policy rules are fully typed based on your action definitions:

```typescript
const policy = definePolicy<Actions>({
  byAction: {
    editPost: [
      {
        id: 'user-edit-own-post',
        effect: 'allow',
        when: ({ subject, resource, changes }) => {
          // TypeScript knows the exact types of all parameters:
          // subject: User
          // resource: Post
          // changes: Partial<Pick<Post, 'title' | 'content'>>

          return subject.id === resource.authorId
        },
        readMask: {
          id: true,
          title: true,
          content: true,
          // TypeScript error if field doesn't exist on Post:
          // invalidField: true,  // ❌ Compile error
        } satisfies FieldMask<Post>,
        reason: 'post-owner'
      }
    ]
  }
})
```

## Compile-Time Validation

### Required Properties

TypeScript enforces that all required properties are provided:

```typescript
// ✅ Valid - all required properties present
const canView = policy.check('viewPost', {
  subject: user,
  resource: post
})

// ❌ TypeScript error - missing 'resource'
const canView = policy.check('viewPost', {
  subject: user
  // Property 'resource' is missing
})

// ❌ TypeScript error - wrong property type
const canEdit = policy.check('editPost', {
  subject: user,
  resource: post,
  changes: "invalid"  // Expected object, got string
})
```

### Action Name Validation

Action names are validated at compile time:

```typescript
// ✅ Valid action name
policy.check('viewPost', { /* ... */ })

// ❌ TypeScript error - action doesn't exist
policy.check('invalidAction', { /* ... */ })
//           ^^^^^^^^^^^^^^^^ Argument of type '"invalidAction"' is not assignable
```

### Field Mask Type Safety

Field masks are type-checked against your resource types:

```typescript
{
  id: 'user-view-post',
  action: 'viewPost',
  effect: 'allow',
  when: ({ subject }) => subject.role === 'user',
  readMask: {
    id: true,
    title: true,
    content: true,
    published: true,
    // TypeScript error - field doesn't exist on Post:
    // invalidField: true,  // ❌ Property 'invalidField' does not exist on type 'Post'
  } satisfies FieldMask<Post>,
  reason: 'user-access'
}
```

## IDE Support

TypeScript provides excellent IDE support with AuthzKit:

### Autocomplete

Get smart autocomplete for action names, properties, and field masks:

```typescript
policy.check('v|')  // IDE suggests: viewPost, viewUser, etc.

policy.check('editPost', {
  subject: user,
  resource: post,
  changes: {
    t|  // IDE suggests: title
    c|  // IDE suggests: content
    // published not suggested (not in allowed fields)
  }
})
```

### Type Hints

See rich type information in your IDE:

```typescript
// Hover over 'decision' to see full type information
const decision = policy.checkDetailed('viewPost', {
  subject: user,
  resource: post
})

// IDE shows:
// const decision: {
//   allow: boolean;
//   reason: string;
//   readMask?: FieldMask<Post>;
//   writeMask?: FieldMask<Post>;
//   attrs?: Record<string, any>;
// }
```

### Inline Error Messages

Get immediate feedback about type errors:

```typescript
policy.check('editPost', {
  subject: user,
  resource: post,
  changes: { role: 'admin' }  // Red underline with error message
  //         ^^^^ Property 'role' does not exist on type 'Partial<Pick<Post, "title" | "content">>'
})
```

## Generic Type Helpers

AuthzKit provides utility types for common patterns:

### FieldMask Type

Ensure field masks match your resource types:

```typescript
import type { FieldMask } from '@authzkit/core'

// Type-safe field mask
const userReadMask: FieldMask<User> = {
  id: true,
  name: true,
  email: true,
  // password: true,  // ❌ TypeScript error if password doesn't exist on User
}

// Use with satisfies for better error messages
const readMask = {
  id: true,
  title: true,
  invalidField: true,  // ❌ Clear error message
} satisfies FieldMask<Post>
```

### Subject and Resource Extraction

Extract types from action definitions:

```typescript
type ViewPostSubject = Actions['viewPost']['subject']  // User
type ViewPostResource = Actions['viewPost']['resource']  // Post

// Use in function signatures
function handlePostView(
  subject: ViewPostSubject,
  resource: ViewPostResource
) {
  return policy.check('viewPost', { subject, resource })
}
```

## Advanced Type Patterns

### Conditional Types

Create sophisticated type relationships:

```typescript
type WriteActions = {
  [K in keyof Actions]: Actions[K] extends { changes: any } ? K : never
}[keyof Actions]

// WriteActions = 'editPost' | 'createPost' | ...

function validateWriteAction<T extends WriteActions>(
  action: T,
  request: Actions[T]
) {
  // TypeScript knows 'request' has a 'changes' property
  return policy.check(action, request)
}
```

### Branded Types

Use branded types for additional safety:

```typescript
type UserId = string & { __brand: 'UserId' }
type PostId = string & { __brand: 'PostId' }

type User = {
  id: UserId
  name: string
}

type Post = {
  id: PostId
  authorId: UserId  // Ensures relationship consistency
  title: string
}

// TypeScript prevents mixing up IDs
const userId: UserId = 'user-123' as UserId
const postId: PostId = 'post-456' as PostId

// This would be a TypeScript error:
// const user: User = { id: postId, name: 'John' }  // ❌ PostId not assignable to UserId
```

### Template Literal Types

Create strongly-typed action names:

```typescript
type ResourceType = 'post' | 'user' | 'comment'
type ActionType = 'view' | 'edit' | 'delete'

type ActionName = `${ActionType}${Capitalize<ResourceType>}`
// ActionName = 'viewPost' | 'editPost' | 'deletePost' | 'viewUser' | ...

const actions = defineActions({
  viewPost: action<{...}>(),
  editPost: action<{...}>(),
  // TypeScript ensures all combinations are defined
} satisfies Record<ActionName, any>)
```

## Runtime Type Safety

While TypeScript provides compile-time safety, you may want runtime validation:

### Zod Integration

Use Zod for runtime type validation:

```typescript
import { z } from 'zod'

const UserSchema = z.object({
  id: z.string(),
  role: z.enum(['admin', 'user', 'moderator']),
  tenantId: z.string()
})

const PostSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  authorId: z.string(),
  tenantId: z.string(),
  published: z.boolean()
})

// Runtime validation with type inference
function checkPostAccess(subjectData: unknown, resourceData: unknown) {
  const subject = UserSchema.parse(subjectData)  // Throws if invalid
  const resource = PostSchema.parse(resourceData)

  // Now TypeScript knows the exact types
  return policy.check('viewPost', { subject, resource })
}
```

### Input Validation

Validate API inputs before authorization:

```typescript
app.post('/api/posts/:id/edit', async (req, res) => {
  try {
    // Validate input shapes
    const subject = UserSchema.parse(req.user)
    const resource = PostSchema.parse(await getPost(req.params.id))
    const changes = PostChangesSchema.parse(req.body)

    const decision = policy.checkDetailed('editPost', {
      subject,
      resource,
      changes
    })

    if (!decision.allow) {
      return res.status(403).json({ error: decision.reason })
    }

    // Apply changes with type safety
    const updatedPost = await updatePost(resource.id, changes)
    res.json(applyReadMask(updatedPost, decision.readMask))

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.issues })
    }
    throw error
  }
})
```

## Testing Type Safety

Test that your types work correctly:

```typescript
describe('Type Safety', () => {
  it('enforces correct action parameters', () => {
    // This should compile
    const validRequest = {
      subject: mockUser,
      resource: mockPost
    } satisfies typeof actions['viewPost']

    expect(validRequest).toBeDefined()

    // This test verifies TypeScript compilation
    const allowed = policy.check('viewPost', validRequest)
    expect(typeof allowed).toBe('boolean')
  })

  it('provides correct decision types', () => {
    const decision = policy.checkDetailed('viewPost', {
      subject: mockUser,
      resource: mockPost
    })

    // TypeScript ensures these properties exist
    expect(typeof decision.allow).toBe('boolean')
    expect(typeof decision.reason).toBe('string')

    if (decision.readMask) {
      // TypeScript knows readMask has Post fields
      expect(typeof decision.readMask.id).toBe('boolean')
      expect(typeof decision.readMask.title).toBe('boolean')
    }
  })
})
```

## Common Type Patterns

### Optional Resource for List Actions

Handle list actions that don't have a specific resource:

```typescript
export const actions = defineActions({
  listPosts: action<{
    subject: User;
    resource?: {}  // Optional for list operations
  }>(),

  viewPost: action<{
    subject: User;
    resource: Post  // Required for specific resource
  }>()
})

// Usage
policy.check('listPosts', { subject: user })  // ✅ No resource needed
policy.check('viewPost', { subject: user, resource: post })  // ✅ Resource required
```

### Union Types for Multi-Resource Actions

Handle actions that work with multiple resource types:

```typescript
type Content = Post | Comment | Article

export const actions = defineActions({
  moderateContent: action<{
    subject: User;
    resource: Content;
    action: 'approve' | 'reject' | 'flag';
  }>()
})

// TypeScript handles union types correctly
const canModerate = policy.check('moderateContent', {
  subject: moderator,
  resource: post,  // Post | Comment | Article
  action: 'approve'
})
```

### Contextual Information

Add typed context for complex scenarios:

```typescript
export const actions = defineActions({
  downloadFile: action<{
    subject: User;
    resource: File;
    context?: {
      ipAddress: string;
      userAgent: string;
      requestId: string;
    }
  }>()
})

// TypeScript validates context structure
policy.check('downloadFile', {
  subject: user,
  resource: file,
  context: {
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    requestId: req.id
  }
})
```

## Performance Considerations

TypeScript compilation can slow down with complex types:

### Type Complexity

Keep type definitions manageable:

```typescript
// ✅ Simple, fast types
type User = {
  id: string
  role: 'admin' | 'user'
  tenantId: string
}

// ❌ Overly complex types (slower compilation)
type ComplexUser = {
  [K in 'id' | 'role' | 'tenant']: K extends 'id' ? string
    : K extends 'role' ? 'admin' | 'user' | 'moderator' | 'guest' | 'superuser'
    : K extends 'tenant' ? { id: string; name: string; plan: 'free' | 'pro' | 'enterprise' }
    : never
}
```

### Incremental Compilation

Structure your types for optimal TypeScript performance:

```typescript
// ✅ Separate type definitions into modules
// types/user.ts
export type User = { /* ... */ }

// types/post.ts
export type Post = { /* ... */ }

// actions/index.ts
import type { User } from '../types/user'
import type { Post } from '../types/post'

export const actions = defineActions({
  viewPost: action<{ subject: User; resource: Post }>()
})
```

## Next Steps

- Explore [Integration Examples](/examples/) to see type safety in real applications
- Check out the [Getting Started](/guides/getting-started) guide to implement AuthzKit
- Learn about [Field-Level Permissions](/concepts/field-permissions) for granular type-safe data access
