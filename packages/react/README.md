# @authzkit/react

React UI guards for AuthzKit. Reuse server decisions during hydration, eliminate flicker, and surface friendly denial states.

Works with any React framework: Next.js (RSC), Remix, React Router, Vite + React, Expo.

## Install

`pnpm add @authzkit/react`

<details>
<summary>Other package managers</summary>

- npm: `npm install @authzkit/react`
- yarn: `yarn add @authzkit/react`
- bun: `bun add @authzkit/react`

</details>

## Usage

Evaluate on the server (route handler / server component), then seed the provider and gate UI with `<Guard>`.

```tsx
// Server: compute a decision (using @authzkit/core)
import { definePolicy } from '@authzkit/core'

export async function getDecision() {
  // You need to define your policy first
  return policy.checkDetailed('post.update', {
    subject: { id: 'u1', role: 'editor', tenantId: 't1' },
    resource: { id: 'p1', authorId: 'u1', tenantId: 't1', status: 'draft' },
  })
}
```

```tsx
// Client: reuse decision without flicker
import { DecisionProvider, Guard } from '@authzkit/react'

export function UpdateSection({ decision }: { decision: any }) {
  return (
    <DecisionProvider value={{ status: decision.allow ? 'allowed' : 'denied', decision }}>
      <Guard denied={() => <p role="alert">Not allowed</p>}>
        <form>{/* ... */}</form>
      </Guard>
    </DecisionProvider>
  )
}
```

## Docs

- [React UI guards guide](https://authzkit.github.io/authzkit/docs/guides/react-ui)
- [Getting started](https://authzkit.github.io/authzkit/docs/guides/getting-started)

