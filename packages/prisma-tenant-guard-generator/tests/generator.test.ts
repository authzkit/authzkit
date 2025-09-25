import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { formatMeta, generateTenantMeta } from '../src/index.js';

const tmpRoot = mkdtempSync(join(tmpdir(), 'tenant-guard-gen-'));

afterAll(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
});

describe('generateTenantMeta', () => {
  it('returns empty meta when no tenant field is found', async () => {
    const schemaPath = join(tmpRoot, 'schema-no-tenant.prisma');
    writeFileSync(
      schemaPath,
      `datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}

generator client {
  provider = "prisma-client-js"
}

model Tenant {
  id String @id
}

model Audit {
  id String @id
  tenant String
}
`,
      'utf8',
    );

    const result = await generateTenantMeta({
      schemaPath,
      outputPath: join(tmpRoot, 'no-meta.ts'),
    });
    expect(result.meta).toEqual({});
  });
});

describe('formatMeta', () => {
  it('serializes to TypeScript module', () => {
    const content = formatMeta({
      Post: {
        tenantField: 'tenantId',
        compositeSelector: 'tenantId_id',
        nestedTargets: {
          author: 'User',
        },
      },
    });

    expect(content).toContain('import type { TenantMeta }');
    expect(content).toContain('Post: {');
    expect(content).toContain('nestedTargets');
    expect(content.trim().endsWith('export default tenantMeta;')).toBe(true);
  });
});
