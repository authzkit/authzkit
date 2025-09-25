import type { ZodTypeAny } from 'zod';

import type { TenantMeta } from './index.js';

export interface TenantRefineConfig {
  meta: TenantMeta;
  tenantField?: string;
}

export function tenantRefine<T extends ZodTypeAny>(
  schema: T,
  cfg: TenantRefineConfig,
): T {
  const tenantField = cfg.tenantField ?? 'tenantId';
  return schema.superRefine((value, ctx) => {
    if (!value || typeof value !== 'object') {
      return;
    }

    const record = value as Record<string, unknown>;

    if (!(tenantField in record)) {
      ctx.addIssue({
        code: 'custom',
        path: [tenantField],
        message: `Missing tenant field ${tenantField}`,
      });
      return;
    }

    const tenantValue = record[tenantField];
    if (typeof tenantValue !== 'string' || tenantValue.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: [tenantField],
        message: `Tenant field ${tenantField} must be a non-empty string`,
      });
    }
  }) as unknown as T;
}
