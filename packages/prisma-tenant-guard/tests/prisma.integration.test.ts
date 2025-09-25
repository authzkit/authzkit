import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Minimal Prisma types to avoid direct import from '@prisma/client' in tests
type User = { id: string; tenantId: string };
type Post = { id: string; title: string; body?: string | null; tenantId: string; authorId: string };
type PostWhere = { id: string } | { tenantId_id: { tenantId: string; id: string } };

interface UserDelegate {
  create(args: { data: User }): Promise<User>;
}

interface PostDelegate {
  create(args: { data: Omit<Post, 'tenantId'> & Partial<Pick<Post, 'tenantId'>> }): Promise<Post>;
  update(args: { where: PostWhere; data: Partial<Pick<Post, 'title' | 'body' | 'tenantId'>> }): Promise<Post>;
  delete(args: { where: { tenantId_id: { tenantId: string; id: string } } }): Promise<unknown>;
}

type PrismaClientInstance = {
  $connect(): Promise<void>;
  $disconnect(): Promise<void>;
  user: UserDelegate;
  post: PostDelegate;
};

type PrismaClientModule = {
  PrismaClient: new (...args: unknown[]) => PrismaClientInstance;
};

import { createTenantClient, type Mode, type TenantMeta } from '../src/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(__dirname, '..');
const pkgRequire = createRequire(join(pkgRoot, 'package.json'));
const tenantMeta: TenantMeta = {
  User: {
    tenantField: 'tenantId',
    compositeSelector: 'tenantId_id',
  },
  Post: {
    tenantField: 'tenantId',
    compositeSelector: 'tenantId_id',
  },
};

const tenantId = 'tenant-a';

let PrismaClient: PrismaClientModule['PrismaClient'];
let prisma: PrismaClientInstance;
let dbPath: string;
let tmpDir: string;

const ensurePrismaClientGenerated = (schemaPath: string, databaseUrl: string) => {
  let prismaCliPath: string | undefined;
  try {
    const prismaPkgPath = pkgRequire.resolve('prisma/package.json');
    prismaCliPath = join(dirname(prismaPkgPath), 'build', 'index.js');
  } catch {
    throw new Error('Prisma CLI is missing. Add devDependency "prisma" and install before running tests.');
  }

  // Push schema to a fresh SQLite DB
  const pushResult = spawnSync(
    process.execPath,
    [prismaCliPath, 'db', 'push', '--schema', schemaPath, '--force-reset'],
    { cwd: pkgRoot, env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: 'inherit' },
  );
  if (pushResult.status !== 0) throw new Error('Failed to push Prisma schema.');

  // Generate client for this schema
  const generateResult = spawnSync(
    process.execPath,
    [prismaCliPath, 'generate', '--schema', schemaPath],
    {
      cwd: pkgRoot,
      stdio: 'inherit',
      env: { ...process.env, PRISMA_GENERATE_SKIP_AUTOINSTALL: '1' },
    },
  );
  if (generateResult.status !== 0) throw new Error('Failed to generate Prisma client.');
};

const createGuard = (mode: Mode = 'strict') =>
  createTenantClient(prisma, {
    tenantId,
    mode,
    meta: tenantMeta,
  });

describe('Prisma integration', () => {
  beforeAll(async () => {
    tmpDir = mkdtempSync(join(pkgRoot, '.tmp-prisma-int-'));
    dbPath = join(tmpDir, 'test.db');

    const prismaDir = join(tmpDir, 'prisma');
    mkdirSync(prismaDir, { recursive: true });
    const schemaPath = join(prismaDir, 'schema.prisma');

    const schema = [
      'datasource db {',
      '  provider = "sqlite"',
      '  url      = env("DATABASE_URL")',
      '}',
      '',
      'generator client {',
      '  provider = "prisma-client-js"',
      '}',
      '',
      'model User {',
      '  id        String @id @default(cuid())',
      '  tenantId  String',
      '  posts     Post[]',
      '  @@index([tenantId, id], name: "tenantId_id")',
      '}',
      '',
      'model Post {',
      '  id        String @id',
      '  title     String',
      '  body      String?',
      '  tenantId  String',
      '  authorId  String',
      '  author    User   @relation(fields: [authorId], references: [id])',
      '  @@unique([tenantId, id], name: "tenantId_id")',
      '}',
    ].join('\n');
    writeFileSync(schemaPath, schema);

    const databaseUrl = `file:${dbPath}`;
    ensurePrismaClientGenerated(schemaPath, databaseUrl);

    const prismaModule = pkgRequire('@prisma/client') as PrismaClientModule;
    ({ PrismaClient } = prismaModule);

    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

    await prisma.$connect();

    // Seed data
    await prisma.user.create({ data: { id: 'user-admin-a', tenantId } });
    await prisma.post.create({
      data: {
        id: 'post-a-1',
        title: 'Tenant A Title',
        body: 'Body',
        tenantId,
        authorId: 'user-admin-a',
      },
    });
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
    if (tmpDir) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('allows tenant-scoped updates when where includes tenant constraint', async () => {
    const guard = createGuard();

    const result = await guard.post.update({
      where: { tenantId_id: { tenantId, id: 'post-a-1' } },
      data: { title: 'Tenant A Updated Title' },
    });

    expect(result.tenantId).toBe(tenantId);
    expect(result.title).toBe('Tenant A Updated Title');
  });

  it('rejects tenant mismatches in update payloads', async () => {
    const guard = createGuard();

    await expect(
      guard.post.update({
        where: { tenantId_id: { tenantId, id: 'post-a-1' } },
        data: { tenantId: 'tenant-b' },
      }),
    ).rejects.toMatchObject({
      details: { code: 'TENANT_MISMATCH' },
    });
  });

  it('fails when where clause omits tenant constraint', async () => {
    const guard = createGuard();

    await expect(
      guard.post.update({
        where: { id: 'post-a-1' },
        data: { title: 'Should Fail' },
      }),
    ).rejects.toMatchObject({
      details: { code: 'WHERE_TENANT_MISSING' },
    });
  });

  it('injects tenantId on create in assist mode', async () => {
    const guard = createGuard('assist');
    const newPostId = `assist-post-${Date.now()}`;

    const created = await guard.post.create({
      data: {
        id: newPostId,
        title: 'Assist Mode Post',
        body: 'Injected tenant id',
        authorId: 'user-admin-a',
      },
    });

    expect(created.tenantId).toBe(tenantId);

    await guard.post.delete({
      where: { tenantId_id: { tenantId, id: newPostId } },
    });
  });
});
