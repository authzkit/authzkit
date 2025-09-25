---
title: Actions
outline: deep
---

# Actions

Actions represent something a user wants to do in your application. They define the "shape" of authorization requests and provide compile-time type safety.

## What is an Action?

An **Action** is a named operation that requires authorization. Actions specify what data is needed to make authorization decisions, ensuring type safety throughout your application.

```typescript
export const actions = defineActions({
  viewPost: action<{
    subject: User;
    resource: Post
  }>(),

  editPost: action<{
    subject: User;
    resource: Post;
    changes?: Partial<Post>
  }>(),

  deletePost: action<{
    subject: User;
    resource: Post
  }>()
})
```

## Defining Actions

Use the `defineActions` function to create a collection of actions:

```typescript
import { action, defineActions } from '@authzkit/core'

// Define your types
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

// Define actions
export const actions = defineActions({
  // Read operations
  viewPost: action<{
    subject: User;
    resource: Post
  }>(),

  listPosts: action<{
    subject: User;
    resource: Post  // Used for type information, not actual data
  }>(),

  // Write operations
  createPost: action<{
    subject: User;
    resource: Omit<Post, 'id'>  // New post without ID
  }>(),

  editPost: action<{
    subject: User;
    resource: Post;
    changes: Partial<Pick<Post, 'title' | 'content'>>  // Only some fields editable
  }>(),

  deletePost: action<{
    subject: User;
    resource: Post
  }>(),

  // Complex operations
  publishPost: action<{
    subject: User;
    resource: Post;
    context?: {
      scheduledFor?: Date;
      notifySubscribers?: boolean;
    }
  }>()
})

export type Actions = typeof actions
```

## Action Properties

### Subject
The **subject** is the entity (usually a user) performing the action:

```typescript
viewPost: action<{
  subject: User;  // Who is trying to view the post?
  resource: Post
}>()
```

### Resource
The **resource** is what the subject wants to access or modify:

```typescript
editPost: action<{
  subject: User;
  resource: Post;  // Which post are they trying to edit?
  changes: Partial<Post>
}>()
```

### Changes (Optional)
For write operations, **changes** represents the data being modified:

```typescript
updateProfile: action<{
  subject: User;
  resource: User;
  changes: {
    name?: string;
    email?: string;
    // password changes not allowed through this action
  }
}>()
```

### Context (Optional)
Additional **context** can provide extra information for authorization:

```typescript
downloadFile: action<{
  subject: User;
  resource: File;
  context?: {
    ipAddress: string;
    userAgent: string;
    downloadReason?: string;
  }
}>()
```

## Type Safety Benefits

Actions provide compile-time guarantees about authorization requests:

### Compilation Errors for Invalid Requests

```typescript
// ✅ Valid request
const canView = policy.check('viewPost', {
  subject: user,
  resource: post
})

// ❌ TypeScript error - missing required fields
const canView = policy.check('viewPost', {
  subject: user
  // Error: Property 'resource' is missing
})

// ❌ TypeScript error - wrong property type
const canEdit = policy.check('editPost', {
  subject: user,
  resource: post,
  changes: "invalid"  // Error: Expected object, got string
})
```

### Autocomplete and IntelliSense

IDEs provide rich autocomplete based on action definitions:

```typescript
policy.check('editPost', {
  subject: user,
  resource: post,
  changes: {
    title: // IDE suggests available fields
    content: // and their types
    // published: // TypeScript prevents editing restricted fields
  }
})
```

## Action Naming Conventions

### Use Descriptive Verbs

Action names should clearly describe what the user is trying to do:

```typescript
// ✅ Clear action names
viewPost: action<{...}>()
editPost: action<{...}>()
deletePost: action<{...}>()
publishPost: action<{...}>()

// ❌ Vague action names
post: action<{...}>()
handlePost: action<{...}>()
doSomething: action<{...}>()
```

### Follow Consistent Patterns

Establish naming patterns across your application:

```typescript
// Pattern: verb + noun
export const actions = defineActions({
  // User actions
  viewUser: action<{...}>(),
  editUser: action<{...}>(),
  deleteUser: action<{...}>(),

  // Post actions
  viewPost: action<{...}>(),
  editPost: action<{...}>(),
  deletePost: action<{...}>(),

  // Comment actions
  viewComment: action<{...}>(),
  editComment: action<{...}>(),
  deleteComment: action<{...}>(),
})
```

### Group Related Actions

Organize actions by domain or feature:

```typescript
// Content management actions
export const contentActions = defineActions({
  createPost: action<{...}>(),
  editPost: action<{...}>(),
  publishPost: action<{...}>(),
  archivePost: action<{...}>(),
})

// User management actions
export const userActions = defineActions({
  viewProfile: action<{...}>(),
  editProfile: action<{...}>(),
  changePassword: action<{...}>(),
  deactivateAccount: action<{...}>(),
})

// Combine into main actions object
export const actions = defineActions({
  ...contentActions,
  ...userActions
})
```

## Complex Action Examples

### Multi-Resource Actions

Some actions may involve multiple resources:

```typescript
transferPost: action<{
  subject: User;
  resource: {
    post: Post;
    fromUser: User;
    toUser: User;
  }
}>()
```

### Conditional Properties

Use TypeScript unions for actions with different requirements:

```typescript
// Different data needed based on operation type
moderateContent: action<{
  subject: User;
  resource: Post | Comment;
  action: 'approve' | 'reject' | 'flag';
  reason?: string;  // Required for reject/flag, optional for approve
}>()
```

### Batch Operations

Actions can handle multiple resources:

```typescript
bulkDeletePosts: action<{
  subject: User;
  resource: Post[];  // Array of posts
  context?: {
    deleteReason: string;
    notifyAuthors: boolean;
  }
}>()
```

## Integration with Policies

Actions work seamlessly with policy rules:

```typescript
// Action definition
const actions = defineActions({
  editPost: action<{
    subject: User;
    resource: Post;
    changes: Partial<Post>
  }>()
})

// Policy rules use the action types
const policy = definePolicy<Actions>({
  rules: [
    {
      id: 'author-can-edit',
      action: 'editPost',  // Must match action name
      effect: 'allow',
      when: ({ subject, resource, changes }) => {
        // TypeScript knows the types of all parameters
        return subject.id === resource.authorId
      },
      writeMask: {
        title: true,
        content: true,
        // published: false  // Authors can't change publish status
      },
      reason: 'post-author'
    }
  ]
})
```

## Testing Actions

Test that your actions have the correct type definitions:

```typescript
describe('Actions Type Safety', () => {
  it('enforces required properties', () => {
    // This should compile
    const validRequest = {
      subject: mockUser,
      resource: mockPost
    } satisfies typeof actions['viewPost']

    expect(validRequest).toBeDefined()
  })

  it('prevents invalid property types', () => {
    // This should cause a TypeScript compilation error
    // const invalidRequest = {
    //   subject: "not a user",  // Error: string not assignable to User
    //   resource: mockPost
    // } satisfies typeof actions['viewPost']
  })
})
```

## Best Practices

### 1. Keep Actions Simple

Each action should represent a single, focused operation:

```typescript
// ✅ Focused action
editPost: action<{
  subject: User;
  resource: Post;
  changes: Partial<Post>
}>()

// ❌ Action doing too much
editPostAndNotifyAndLog: action<{
  subject: User;
  resource: Post;
  changes: Partial<Post>;
  notification: NotificationConfig;
  logLevel: LogLevel;
}>()
```

### 2. Use Descriptive Types

Make your action types as specific as possible:

```typescript
// ✅ Specific types
updateUserProfile: action<{
  subject: User;
  resource: User;
  changes: Pick<User, 'name' | 'email' | 'bio'>  // Only these fields editable
}>()

// ❌ Too permissive
updateUser: action<{
  subject: User;
  resource: User;
  changes: any  // Could be anything
}>()
```

### 3. Document Complex Actions

Add JSDoc comments for actions with complex requirements:

```typescript
/**
 * Transfers ownership of a post from one user to another.
 *
 * Requirements:
 * - Subject must be admin or current post owner
 * - Target user must be in same tenant
 * - Post must not be published
 */
transferPostOwnership: action<{
  subject: User;
  resource: {
    post: Post;
    newOwner: User;
  };
  context?: {
    transferReason: string;
  }
}>()
```

### 4. Version Your Actions

When actions evolve, consider versioning:

```typescript
// v1 - original action
createPost: action<{
  subject: User;
  resource: Omit<Post, 'id'>
}>()

// v2 - action with additional requirements
createPostV2: action<{
  subject: User;
  resource: Omit<Post, 'id'>;
  context: {
    category: string;
    tags: string[];
  }
}>()
```

## Next Steps

- Learn about [Policies & Rules](/concepts/policies) to see how actions are used in authorization logic
- Explore [Field-Level Permissions](/concepts/field-permissions) to control data access
- Check out [Type Safety](/concepts/type-safety) for more details on TypeScript integration