---
title: Migration Guide (v1.0.0-rc)
outline: deep
---

# Migration Guide (v1.0.0-rc)

This guide covers the changes required when upgrading from the pre-release alpha builds to the `1.0.0-rc` series of AuthzKit packages.

## Package versions

All first-party packages publish as `1.0.0-rc.0`. Update your `package.json` to match:

```json
{
  "dependencies": {
    "@authzkit/core": "1.0.0-rc.0",
    "@authzkit/prisma-tenant-guard": "1.0.0-rc.0",
    "@authzkit/react": "1.0.0-rc.0"
  },
  "devDependencies": {
    "@authzkit/prisma-tenant-guard-generator": "1.0.0-rc.0"
  }
}
```



## Subject handling

The demo replaces query-parameter subject selection with a cookie-backed session flow.

- POST the desired tenant/user to `/api/session` to persist the selection.
- `getCurrentSubject(selection)` now falls back to the cookie before using the default catalog entry.
- Client updates flow through the API route; the legacy server action was removed.

Applications that rely on query parameters can still pass `tenant`/`user` in `SubjectSelection`; the helper continues to accept them for backward compatibility.

## Policy-aware RPC route

Updates now flow through `app/api/posts/[postId]/route.ts` which:

1. Normalises the JSON payload with `prepareUpdatePayload`.
2. Resolves the active subject from the session cookie.
3. Evaluates `post.update`, applies Prisma write masks, and runs the mutation inside `runTenantMutation`.
4. Returns the policy decision alongside the devtools timeline snapshot.

## Devtools timeline

`@/lib/devtools` records every decision (SSR, API, client). The React surface renders a timeline panel fed by `/api/devtools/timeline`. Hook the same recorder into background jobs or other adapters by calling `recordDecision({ action, subject, decision, source })` after each check.

## Linting & build

```bash
pnpm lint
pnpm --filter @authzkit/prisma-tenant-guard test
pnpm --filter @authzkit/prisma-tenant-guard-generator test
```

Keep these checks green before cutting a new RC.

---

If you hit unexpected issues upgrading, open a discussion with repro steps and we’ll expand the guide.
