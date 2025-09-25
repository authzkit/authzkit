---
title: Examples
outline: deep
---

# Examples

Code snippets and integration guides showing how to use AuthzKit with different frameworks and databases.

## [Next.js + Prisma](./nextjs-prisma)

Setup guide for integrating AuthzKit with Next.js and Prisma.

- Shows SSR-safe guard patterns, policy compilation, and tenant isolation

## [Prisma Minimal Setup](./prisma)

Basic integration example showing core AuthzKit + Prisma patterns.

- Demonstrates field masks and query filters from policy decisions

## [Drizzle](./drizzle) & [Kysely](./kysely)

Integration examples for SQL query builders.

- Shows how to compile decisions into SQL-safe filters (note: adapters not yet implemented)

## [RPC / API Routes](./rpc)

Code example for protecting API endpoints with policy decisions.

- Demonstrates request validation and explainable authorization responses
