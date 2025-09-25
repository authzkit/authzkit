---
layout: home
title: AuthzKit
---

<CustomHero
  text="The last authorization library you'll need."
  tagline="Define policies once, get database filters, UI guards, and API protection automatically — for both JavaScript and TypeScript."
  :actions="[
    { theme: 'brand', text: 'Get started', link: '/authzkit/guides/getting-started.html' },
  ]"
/>

## Key Features

<div class="features-grid">
  <div class="feature-card">
    <div class="feature-icon">🛡️</div>
    <h3>Security by Construction</h3>
    <p>Eliminate entire classes of authorization bugs through compile-time validation and automated tenant isolation.</p>
  </div>

  <div class="feature-card">
    <div class="feature-icon">⚡</div>
    <h3>Zero Boilerplate</h3>
    <p>Write policies once, get type-safe API guards, database filters, and UI components automatically.</p>
  </div>

  <div class="feature-card">
    <div class="feature-icon">🔧</div>
    <h3>Works with Your Stack</h3>
    <p>Drop-in support for Prisma, Next.js, React, Express, and any TypeScript application.</p>
  </div>

  <div class="feature-card">
    <div class="feature-icon">🚀</div>
    <h3>Production Ready</h3>
    <p>Battle-tested in high-scale applications with sub-millisecond overhead and comprehensive error handling.</p>
  </div>

  <div class="feature-card">
    <div class="feature-icon">👥</div>
    <h3>Team-Friendly</h3>
    <p>Clear error messages, visual policy debugging, and documentation that makes security approachable.</p>
  </div>

  <div class="feature-card">
    <div class="feature-icon">🔄</div>
    <h3>Multi-Tenant Safe</h3>
    <p>Automatic tenant isolation prevents cross-tenant data leaks without manual validation code.</p>
  </div>
</div>

<style scoped>
.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 24px;
  margin: 48px 0;
  padding: 0 24px;
}

.feature-card {
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  padding: 24px;
  text-align: center;
  transition: all 0.3s ease;
}

.feature-card:hover {
  border-color: var(--vp-c-brand-1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.feature-icon {
  font-size: 2rem;
  margin-bottom: 16px;
}

.feature-card h3 {
  color: var(--vp-c-text-1);
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 0 12px 0;
}

.feature-card p {
  color: var(--vp-c-text-2);
  margin: 0;
  line-height: 1.6;
}

@media (max-width: 640px) {
  .features-grid {
    grid-template-columns: 1fr;
    gap: 16px;
    padding: 0 16px;
  }

  .feature-card {
    padding: 20px;
  }
}
</style>

## The Problem

Traditional authorization approaches scatter security logic across your codebase:

::: code-group

```typescript [❌ Manual Authorization]
// Scattered checks everywhere - easy to forget or get wrong
if (user.role !== 'admin' && user.tenantId !== post.tenantId) {
  throw new Error('Access denied')
}

if (!canUserEditPost(user, post)) {
  throw new Error('Cannot edit')
}

// Repeated in 100+ places across your app...
```

:::

::: danger Result
Authorization bugs in production, security vulnerabilities, and frustrated developers.
:::

## The AuthzKit Solution

Define policies once, enforce everywhere automatically:

::: code-group

```typescript [✅ AuthzKit Policies]
// Define once - centralized and type-safe
const policy = definePolicy({
  byAction: {
    'post.edit': [{
      effect: 'allow',
      when: ({ subject, resource }) =>
        subject.id === resource.authorId || subject.role === 'admin'
    }]
  }
})

// Use everywhere - automatic enforcement
const decision = policy.checkDetailed('post.edit', { subject: user, resource: post })

// Use decision results for authorization
if (!decision.allow) {
  throw new Error(decision.reason || 'Access denied')
}

// Apply field masking using readMask
const posts = await prisma.post.findMany({
  // Apply any filtering based on decision attributes
  where: decision.attrs || {}
})
```

:::

::: tip Result
Security bugs become impossible, not just unlikely.
:::

## Why AuthzKit?

::: details Before AuthzKit: Security Chaos
- ❌ Authorization scattered across 100+ files
- ❌ Easy to forget checks in new features
- ❌ Manual tenant validation everywhere
- ❌ Security bugs discovered in production
- ❌ Slow, error-prone development
:::

::: details After AuthzKit: Security by Design
- ✅ All authorization in centralized policies
- ✅ Compile-time errors prevent security bugs
- ✅ Automatic tenant isolation
- ✅ Security violations impossible by construction
- ✅ Fast, confident development
:::

 
