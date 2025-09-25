# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture Overview

AuthzKit is a TypeScript authorization library organized as a monorepo with these core packages:

- **`@authzkit/core`** - Policy engine core that defines, compiles, and executes authorization policies
- **`@authzkit/react`** - React components (`<Guard>`, `<DecisionProvider>`) and hooks (`useDecision()`)
- **`@authzkit/prisma-tenant-guard`** - Prisma integration for automatic tenant isolation and query filtering
- **`@authzkit/prisma-tenant-guard-generator`** - Code generator for tenant guard metadata from Prisma schemas

The monorepo uses:
- **pnpm workspaces** for package management
- **tsup** for building packages (ESM + CJS dual exports)
- **vitest** for testing with coverage
- **changeset** for version management
- **vitepress** for documentation

## Essential Commands

### Type Checking (CRITICAL)
```bash
pnpm typecheck        # Type check all packages
pnpm typecheck-all    # Type check all packages
```
**IMPORTANT:** Always run type checking before any commit, build, or test. The codebase enforces strict TypeScript compliance.

### Development
```bash
pnpm install          # Install dependencies
pnpm dev             # Watch packages + run tests in parallel
pnpm dev:packages    # Watch build packages only
pnpm dev:test        # Run vitest in watch mode
```

### Building & Testing
```bash
pnpm build           # Build all packages (runs typecheck first)
pnpm test            # Run tests with coverage (runs typecheck first)
pnpm lint            # ESLint + Prettier (runs typecheck first)
pnpm format          # Check formatting (runs typecheck first)
pnpm format:write    # Fix formatting (runs typecheck first)
```

### Single Package Operations
```bash
pnpm --filter @authzkit/core build        # Build specific package
pnpm --filter @authzkit/core test         # Test specific package
pnpm --filter @authzkit/core typecheck    # Typecheck specific package
```

### Documentation
```bash
pnpm docs:dev        # Serve docs locally
pnpm docs:build      # Build documentation
```

### CLI Tools (for Prisma integration)
```bash
pnpm exec authzkit-tenant-guard-gen    # Generate tenant guard metadata
pnpm exec authzkit-tenant-guard check  # Validate tenant safety
```

## Package Structure

Each package in `packages/` follows this structure:
- `src/` - TypeScript source files
- `dist/` - Built output (ESM + CJS)
- `tsconfig.json` - Package-specific TypeScript config
- `tsconfig.build.json` - Build-specific TypeScript config
- Individual `package.json` with build/test/typecheck scripts

## Key Patterns

### Policy Definition
The core pattern is `definePolicy()` which creates type-safe authorization policies:
- Rules with `action`, `effect`, `when` conditions
- Automatic database filter generation
- Field-level masking support
- Multi-tenant isolation

### React Integration
- `<DecisionProvider>` provides authorization context
- `<Guard>` conditionally renders based on permissions
- `useDecision()` hook for programmatic access

### Prisma Integration
- Automatic tenant field validation
- Query filtering based on policy decisions
- Code generation from Prisma schema

## Development Notes

- All scripts run `typecheck-all` first to ensure type safety
- Uses conventional commits for version management
- Supports both JavaScript and TypeScript consumers via dual exports
- Documentation is in `docs/` using VitePress