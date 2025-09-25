---
title: Tenant Guard
outline: deep
---

# Tenant Guard

AuthzKit Tenant Guard provides automatic multi-tenant security for Prisma applications, making cross-tenant data violations impossible by construction.

::: tip Comprehensive Documentation Available
For complete Tenant Guard documentation, installation guides, examples, and advanced features, visit the dedicated [Tenant Guard section](/tenant-guard/).
:::

## Quick Overview

AuthzKit Tenant Guard enforces hard tenant isolation across every nested mutation. Key features include:

- **Zero boilerplate** - No manual tenant validation code required
- **Automatic protection** - Validates all nested operations recursively
- **Production performance** - Sub-millisecond validation overhead
- **Complete coverage** - Handles connects, creates, updates, deletes

## Get Started

1. **[Installation](/tenant-guard/installation)** - Detailed setup instructions
2. **[Quick Start](/tenant-guard/quick-start)** - Get running in 5 minutes
3. **[How It Works](/tenant-guard/concepts)** - Understanding how AuthzKit works
4. **[Examples](/examples/nextjs-prisma)** - See it in action

## Quick Install

::: code-group
```bash [pnpm]
pnpm add @authzkit/prisma-tenant-guard
```

```bash [npm]
npm install @authzkit/prisma-tenant-guard
```

```bash [yarn]
yarn add @authzkit/prisma-tenant-guard
```

```bash [bun]
bun add @authzkit/prisma-tenant-guard
```
:::

## Next Steps

Visit the comprehensive [Tenant Guard documentation](/tenant-guard/) for:

- **[Installation Guide](/tenant-guard/installation)** - Complete setup instructions for all frameworks
- **[Quick Start](/tenant-guard/quick-start)** - Get running in under 5 minutes
- **[How It Works](/tenant-guard/concepts)** - Deep dive into how protection works
- **[Configuration](/tenant-guard/configuration)** - Advanced settings and modes
- **[Security Testing](/tenant-guard/security-testing)** - Verify your protection works
- **[Migration Guide](/tenant-guard/migration)** - Migrate existing applications

::: info Why Tenant Guard?
Traditional multi-tenant applications require manual tenant validation in every database operation. AuthzKit Tenant Guard makes cross-tenant violations **impossible by construction** through automatic validation at the Prisma extension level.
:::
