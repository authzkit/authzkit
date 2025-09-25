---
title: React UI Guards
outline: deep
---

# React UI Guards

`@authzkit/react` keeps your client and server in sync by reusing policy decisions during hydration. This guide covers the primitives you need to eliminate flicker and expose helpful denial states.

## Install

::: code-group
```bash [pnpm]
pnpm add @authzkit/react
```

```bash [npm]
npm install @authzkit/react
```

```bash [yarn]
yarn add @authzkit/react
```

```bash [bun]
bun add @authzkit/react
```
:::

The package exports a `<Guard>` component, a `DecisionProvider`, and hooks for reading decisions in the component tree.

::: tip
`@authzkit/react` is framework‑agnostic within the React ecosystem. Use it with Next.js (RSC), Remix, React Router, Vite + React, or Expo.
:::

## Reuse server decisions

Evaluate policies on the server (API route, loader, or server component) and pass the raw `PolicyDecision` to the client. Wrap the part of your UI that depends on the decision with `DecisionProvider`.

```tsx
import { DecisionProvider } from '@authzkit/react';
import type { PolicyDecision } from '@authzkit/core';
import type { AppActions } from '../policy';

export function UpdateWorkspace({
  decision,
  children,
}: {
  decision: PolicyDecision<AppActions, 'post.update'>;
  children: React.ReactNode;
}) {
  return <DecisionProvider value={{ status: decision.allow ? 'allowed' : 'denied', decision }}>{children}</DecisionProvider>;
}
```

## Gate components with `<Guard>`

`<Guard>` reads the nearest decision and renders the happy path or a denial fallback. Use it to prevent pop-in during hydration and to surface explanatory messages.

```tsx
import { Guard } from '@authzkit/react';

export function UpdateForm() {
  return (
    <Guard
      denied={({ decision }) => (
        <div role="alert" className="banner banner--danger">
          <strong>Update blocked.</strong>
          <p>{decision?.reason ?? 'Policy denied this action.'}</p>
        </div>
      )}
    >
      <form>{/* your update UI */}</form>
    </Guard>
  );
}
```

## Read decisions anywhere

Need to show masks, reasons, or subject data deeper in the tree? Reach for `useDecision`.

```tsx
import { useDecision } from '@authzkit/react';
import type { AppActions } from '../policy';

export function MaskSummary() {
  const { decision } = useDecision<AppActions, 'post.update'>();
  if (!decision) {
    return null;
  }

  const fields = Object.entries(decision.writeMask ?? {})
    .filter(([, allowed]) => allowed)
    .map(([key]) => key);

  return <p>Writable fields: {fields.length > 0 ? fields.join(', ') : 'none'}</p>;
}
```

## SSR and streaming frameworks

- **Next.js / React Server Components:** evaluate policy decisions in your server component, pass them to a client component via props, and wrap with `DecisionProvider` there.
- **Remix / React Router:** load decisions in the route loader and embed them in the initial HTML payload before hydrating.
- **Expo / React Native:** compute decisions on the server (or locally if safe) and seed the provider at the root of the app.

## Pair with policy masks

Combine UI guards with the utilities in [Policy Masks](./policy-masks) so your forms and API calls stay aligned with the same write mask.

Next, learn how to prevent cross-tenant access with the [Tenant Guard](./tenant-guard).
