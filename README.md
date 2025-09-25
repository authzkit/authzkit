# AuthzKit · The Last Authorization Library You'll Need

<p align="center">
  <img src="https://img.shields.io/badge/authorization-type--safe-111827?style=for-the-badge" alt="Type-safe authorization" />

  <img src="https://img.shields.io/badge/JavaScript-✓-f7df1e?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript support" />

  <img src="https://img.shields.io/badge/TypeScript-✓-3178c6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript support" />
  
  <img src="https://img.shields.io/badge/ESM%20%2B%20CJS-✓-6366f1?style=for-the-badge" alt="Universal compatibility" />

<img src="https://img.shields.io/badge/CI-green?style=for-the-badge&logo=githubactions&logoColor=white" alt="CI status" />

<img src="https://img.shields.io/badge/packages-4-0ea5e9?style=for-the-badge&logo=pnpm&logoColor=white" alt="Package count" />

</p>

**AuthzKit prevents authorization bugs by making security policies type-safe, centralized, and impossible to mess up.** Define policies once, get database filters, UI guards, and API protection automatically — for both JavaScript and TypeScript.

```javascript
// Define once - centralized and type-safe
const policy = definePolicy({
  rules: [
    {
      action: 'post.edit',
      effect: 'allow',
      when: ({ subject, resource }) =>
        subject.id === resource.authorId || subject.role === 'admin',
    },
  ],
});

// Use everywhere - automatic enforcement
const canEdit = policy.check('post.edit', { subject: user, resource: post });
```

---

## Why AuthzKit

### Before AuthzKit: Security Chaos 😵

- ❌ Authorization scattered across 100+ files
- ❌ Easy to forget checks in new features
- ❌ Manual tenant validation everywhere
- ❌ Security bugs discovered in production
- ❌ Slow, error-prone development

### After AuthzKit: Security by Design ✅

- ✅ **Universal compatibility** — Works with JavaScript, TypeScript, ESM, and CommonJS
- ✅ **Centralized policies** — All authorization in one place with type safety
- ✅ **Automatic enforcement** — Database filters, UI guards, and API protection generated automatically
- ✅ **Compile-time errors** — Security bugs become impossible, not just unlikely
- ✅ **Multi-tenant safe** — Automatic tenant isolation prevents cross-tenant data leaks
- ✅ **Production ready** — Sub-millisecond performance with comprehensive error handling

---

## Quick Start

```bash
# Install the core package (works with JavaScript or TypeScript)
pnpm add @authzkit/core

# For React-based frameworks, also install
pnpm add @authzkit/react

# For Prisma users (optional)
pnpm add @authzkit/prisma-tenant-guard
```

```javascript
// Create your first policy
import { definePolicy } from '@authzkit/core';

const blogPolicy = definePolicy({
  rules: [
    {
      action: 'post.read',
      effect: 'allow',
      when: ({ resource }) => resource.published,
    },
    {
      action: 'post.edit',
      effect: 'allow',
      when: ({ subject, resource }) => subject.id === resource.authorId,
    },
  ],
});

// Use it anywhere in your app
const canEdit = blogPolicy.check('post.edit', {
  subject: { id: 'user123' },
  resource: { id: 'post456', authorId: 'user123' },
});
```

---

## Packages

| Package                                   | What it does                                                                     |
| ----------------------------------------- | -------------------------------------------------------------------------------- |
| `@authzkit/core`                          | **Policy engine core** — Define, compile, and execute authorization policies     |
| `@authzkit/react`                         | **React components** — `<Guard>`, `<DecisionProvider>`, and `useDecision()` hook |
| `@authzkit/prisma-tenant-guard`           | **Prisma integration** — Automatic tenant isolation and query filtering          |
| `@authzkit/prisma-tenant-guard-generator` | **Code generator** — Auto-generate tenant guard metadata from Prisma schemas     |

---

## React Integration

AuthzKit includes React components for declarative authorization UI:

```jsx
import { DecisionProvider, Guard } from '@authzkit/react';

function App() {
  const decision = policy.checkDetailed('post.edit', { subject: user, resource: post });

  return (
    <DecisionProvider
      value={{
        status: decision.allow ? 'allowed' : 'denied',
        decision,
      }}
    >
      <PostEditor />
    </DecisionProvider>
  );
}

function PostEditor() {
  return (
    <Guard
      pending={<div>Checking permissions...</div>}
      denied={<div>You cannot edit this post</div>}
    >
      <form>
        <input type="text" placeholder="Post title" />
        <button type="submit">Save</button>
      </form>
    </Guard>
  );
}
```

---

## Prisma Integration & CLI Tools

For Prisma users, AuthzKit provides additional tools:

- **`authzkit-tenant-guard`** — CLI for validating tenant safety in Prisma schemas
- **`authzkit-tenant-guard-gen`** — Code generator for tenant guard metadata

```bash
# Generate tenant guard metadata
pnpm exec authzkit-tenant-guard-gen

# Validate tenant safety
pnpm exec authzkit-tenant-guard check
```

---

## Documentation & Resources

- **[Getting Started Guide](docs/guides/getting-started.md)** — Your first AuthzKit policy
- **[Prisma Integration](docs/guides/tenant-guard.md)** — Multi-tenant safety with Prisma
- **[API Reference](docs/)** — Complete API documentation

---

## Development & Contributing

### Workspace Scripts

```bash
pnpm install
pnpm build       # Compile all packages via tsup
pnpm lint        # ESLint + Prettier
pnpm typecheck   # Strict TypeScript validation
pnpm test        # Vitest with coverage thresholds
pnpm dev         # Watch packages + Vitest in parallel
```

### Contributing Guidelines

1. Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` before opening a PR
2. Follow Conventional Commits (`feat(core): ...`, `fix(tenant-guard): ...`)
3. Update relevant docs for user-facing changes
4. Pull requests target the `master` branch

---

## License

MIT — See [LICENSE](LICENSE) file for details.
