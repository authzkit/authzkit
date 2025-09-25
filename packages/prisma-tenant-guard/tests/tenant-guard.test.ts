import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { sep } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { runTenantGuardCli } from '../src/cli.js';
import {
  createTenantClient,
  withTenantRLS,
  type CreateTenantClientOptions,
  type PrismaClientLike,
  type TenantGuardWarning,
} from '../src/index.js';

type TenantGuardConfig = CreateTenantClientOptions;

const warnings: TenantGuardWarning[] = [];

afterEach(() => {
  warnings.length = 0;
});

class TestPrisma implements PrismaClientLike {
  $extends(extension: unknown): PrismaClientLike {
    if (!extension || typeof extension !== 'object') {
      throw new Error('Invalid extension provided');
    }
    const query = (extension as Record<string, unknown>).query;
    if (!query || typeof query !== 'object') {
      throw new Error('Extension missing query handler');
    }
    const allModels = (query as Record<string, unknown>).$allModels;
    if (!allModels || typeof allModels !== 'object') {
      throw new Error('Extension missing $allModels handler');
    }
    const allOperations = (allModels as Record<string, unknown>).$allOperations;
    if (typeof allOperations !== 'function') {
      throw new Error('Extension missing $allOperations handler');
    }
    return new GuardedTestPrisma(
      allOperations as unknown as (payload: {
        model: string;
        operation: string;
        args: Record<string, unknown>;
        query: (args: Record<string, unknown>) => Promise<unknown>;
      }) => Promise<unknown>,
    );
  }
}

class GuardedTestPrisma extends TestPrisma {
  constructor(
    private readonly handler: (payload: {
      model: string;
      operation: string;
      args: Record<string, unknown>;
      query: (args: Record<string, unknown>) => Promise<unknown>;
    }) => Promise<unknown>,
  ) {
    super();
  }

  async execute(payload: {
    model: string;
    operation: string;
    args: Record<string, unknown>;
  }) {
    return this.handler({
      ...payload,
      query: async (args: Record<string, unknown>) => args,
    });
  }
}

const baseMeta = {
  Post: {
    tenantField: 'tenantId',
    compositeSelector: 'tenantId_id',
    nestedTargets: {
      comments: { create: 'Comment', update: 'Comment', $default: 'Comment' },
    },
  },
  Comment: {
    tenantField: 'tenantId',
    compositeSelector: 'tenantId_id',
  },
} satisfies CreateTenantClientOptions['meta'];

describe('createTenantClient', () => {
  it('injects tenant field in assist mode when missing on create', async () => {
    const prisma = new TestPrisma();
    const tenantClient = createTenantClient(prisma, {
      tenantId: 'tenant-a',
      mode: 'assist',
      meta: baseMeta,
      onWarn: (warning) => warnings.push(warning),
    });

    const client = tenantClient as GuardedTestPrisma;
    const result = (await client.execute({
      model: 'Post',
      operation: 'create',
      args: { data: { title: 'Post' } },
    })) as { data: Record<string, unknown> };

    expect(result.data.tenantId).toBe('tenant-a');
    expect(warnings.some((warn) => warn.code === 'INJECT_TENANT_FIELD')).toBe(true);
  });

  it('rejects cross-tenant create attempts', async () => {
    const prisma = new TestPrisma();
    const tenantClient = createTenantClient(prisma, {
      tenantId: 'tenant-a',
      mode: 'assert',
      meta: baseMeta,
    });

    const client = tenantClient as GuardedTestPrisma;

    await expect(
      client.execute({
        model: 'Post',
        operation: 'create',
        args: { data: { tenantId: 'tenant-b' } },
      }),
    ).rejects.toMatchObject({
      details: { code: 'TENANT_MISMATCH', path: 'Post.data' },
    });
  });

  it('walks nested relations and enforces tenant boundaries', async () => {
    const prisma = new TestPrisma();
    const tenantClient = createTenantClient(prisma, {
      tenantId: 'tenant-a',
      mode: 'strict',
      meta: baseMeta,
    });

    const client = tenantClient as GuardedTestPrisma;

    await expect(
      client.execute({
        model: 'Post',
        operation: 'create',
        args: {
          data: {
            tenantId: 'tenant-a',
            comments: {
              create: [{ tenantId: 'tenant-a' }],
            },
          },
        },
      }),
    ).resolves.toBeTruthy();

    await expect(
      client.execute({
        model: 'Post',
        operation: 'create',
        args: {
          data: {
            tenantId: 'tenant-a',
            comments: {
              create: [{ tenantId: 'tenant-b' }],
            },
          },
        },
      }),
    ).rejects.toMatchObject({
      details: { code: 'TENANT_MISMATCH', path: 'Post.data.comments.create[0]' },
    });
  });

  it('fails fast in strict mode when nested meta is missing', async () => {
    const prisma = new TestPrisma();
    const tenantClient = createTenantClient(prisma, {
      tenantId: 'tenant-a',
      mode: 'strict',
      meta: {
        Post: {
          tenantField: 'tenantId',
        },
      },
    });

    const client = tenantClient as GuardedTestPrisma;

    await expect(
      client.execute({
        model: 'Post',
        operation: 'create',
        args: {
          data: {
            tenantId: 'tenant-a',
            comments: {
              create: [{ tenantId: 'tenant-a' }],
            },
          },
        },
      }),
    ).rejects.toMatchObject({
      details: { code: 'TENANT_META_MISSING' },
    });
  });

  it('allows missing nested meta when strict mode has RLS enabled', async () => {
    const prisma = new TestPrisma();
    const tenantClient = createTenantClient(prisma, {
      tenantId: 'tenant-a',
      mode: 'strict',
      meta: {
        Post: {
          tenantField: 'tenantId',
        },
      },
      rls: { enabled: true },
    });

    const client = tenantClient as GuardedTestPrisma;

    await expect(
      client.execute({
        model: 'Post',
        operation: 'create',
        args: {
          data: {
            tenantId: 'tenant-a',
            comments: {
              create: [{ tenantId: 'tenant-a' }],
            },
          },
        },
      }),
    ).resolves.toBeTruthy();
  });
});

describe('withTenantRLS', () => {
  it('sets configuration variable inside transaction', async () => {
    const calls: Array<{ query: string; tenant: string }> = [];
    const prisma: PrismaClientLike = {
      $extends: () => prisma,
      $transaction: async <T>(fn: (tx: PrismaClientLike) => Promise<T>): Promise<T> => fn(prisma),
      $executeRawUnsafe: async (query: unknown, tenant: unknown) => {
        calls.push({ query: query as string, tenant: tenant as string });
        return null;
      },
    } as unknown as PrismaClientLike;

    const result = await withTenantRLS(
      prisma,
      'tenant-a',
      async () => 'ok',
      'app.tenant_id',
    );
    expect(result).toBe('ok');
    expect(calls).toHaveLength(1);
    const first = calls[0]!;
    expect(first.query).toContain("set_config('app.tenant_id'");
    expect(first.tenant).toBe('tenant-a');
  });

  it('throws when $transaction is missing', async () => {
    const prisma: PrismaClientLike = {
      $extends: (ext) => ext as PrismaClientLike,
    } as PrismaClientLike;

    await expect(
      withTenantRLS(prisma, 'tenant-a', async () => 'ok'),
    ).rejects.toMatchObject({
      details: { code: 'RLS_CLIENT_MISSING' },
    });
  });
});

describe('CLI', () => {
  it('runs check and smoke commands successfully', async () => {
    const tmp = mkdtempSync(`${tmpdir()}${sep}tenant-guard-`);

    const config = {
      tenantId: 'tenant-a',
      mode: 'strict',
      meta: baseMeta,
      rls: { enabled: true, varName: 'app.tenant_id' },
    } satisfies TenantGuardConfig;

    writeFileSync(`${tmp}/tenant-guard.config.json`, JSON.stringify(config));

    const check = await runTenantGuardCli(['check'], { cwd: tmp, silent: true });
    expect(check.status).toBe('ok');

    const smoke = await runTenantGuardCli(['smoke'], { cwd: tmp, silent: true });
    expect(smoke.status).toBe('ok');
  });

  it('loads metadata from external JSON file', async () => {
    const tmp = mkdtempSync(`${tmpdir()}${sep}tenant-guard-meta-file-`);
    const metaPath = `${tmp}/meta.json`;

    writeFileSync(metaPath, JSON.stringify(baseMeta, null, 2));

    writeFileSync(
      `${tmp}/tenant-guard.config.json`,
      JSON.stringify(
        {
          tenantId: 'tenant-a',
          mode: 'strict',
          metaFile: './meta.json',
          rls: { enabled: true, varName: 'app.tenant_id' },
        },
        null,
        2,
      ),
    );

    const result = await runTenantGuardCli(['check'], { cwd: tmp, silent: true });
    expect(result.status).toBe('ok');
  });

  it('fails when strict mode is used without enabling RLS', async () => {
    const tmp = mkdtempSync(`${tmpdir()}${sep}tenant-guard-strict-`);

    writeFileSync(
      `${tmp}/tenant-guard.config.json`,
      JSON.stringify(
        {
          tenantId: 'tenant-a',
          mode: 'strict',
          meta: baseMeta,
          rls: { enabled: false },
        },
        null,
        2,
      ),
    );

    const result = await runTenantGuardCli(['check'], { cwd: tmp, silent: true });
    expect(result.status).toBe('error');
    expect(result.messages[0]).toContain('strict mode requires rls.enabled=true');
  });

  it('returns error when config is missing', async () => {
    const tmp = mkdtempSync(`${tmpdir()}${sep}tenant-guard-`);

    const result = await runTenantGuardCli(['check'], { cwd: tmp, silent: true });
    expect(result.status).toBe('error');
    expect(result.messages[0]).toContain('Failed to read config');
  });
});
