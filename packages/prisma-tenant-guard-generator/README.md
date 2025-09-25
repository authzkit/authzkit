# @authzkit/prisma-tenant-guard-generator

Generate tenant guard metadata directly from your Prisma schema. The outputs are consumed by the runtime and CLI to enforce strict tenant isolation.

## Install (dev)

`pnpm add -D @authzkit/prisma-tenant-guard-generator`

<details>
<summary>Other package managers</summary>

- npm: `npm install --save-dev @authzkit/prisma-tenant-guard-generator`
- yarn: `yarn add --dev @authzkit/prisma-tenant-guard-generator`
- bun: `bun add -d @authzkit/prisma-tenant-guard-generator`

</details>

## Usage

Run after every Prisma schema change:

- pnpm:

  ```bash
  pnpm exec authzkit-tenant-guard-gen \
    --schema prisma/schema.prisma \
    --out .prisma/tenant-guard/meta.ts \
    --emitJson
  ```

- npm:

  ```bash
  npm exec authzkit-tenant-guard-gen \
    --schema prisma/schema.prisma \
    --out .prisma/tenant-guard/meta.ts \
    --emitJson
  ```

- yarn:

  ```bash
  yarn authzkit-tenant-guard-gen \
    --schema prisma/schema.prisma \
    --out .prisma/tenant-guard/meta.ts \
    --emitJson
  ```

- bun:

  ```bash
  bunx authzkit-tenant-guard-gen \
    --schema prisma/schema.prisma \
    --out .prisma/tenant-guard/meta.ts \
    --emitJson
  ```

## Docs

- [CLI reference](https://authzkit.github.io/authzkit/docs/reference/cli)
- [Tenant Guard guide](https://authzkit.github.io/authzkit/docs/guides/tenant-guard)

