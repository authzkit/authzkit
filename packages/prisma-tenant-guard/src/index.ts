export type Mode = 'assist' | 'assert' | 'strict';

export interface NestedTargetConfig {
  $default?: string;
  [operation: string]: string | undefined;
}

export interface TenantMetaModel {
  tenantField?: string;
  compositeSelector?: string;
  nestedTargets?: Record<string, NestedTargetConfig | string>;
}

export type TenantMeta = Record<string, TenantMetaModel>;

export interface CreateTenantClientOptions {
  tenantId: string;
  meta: TenantMeta;
  mode?: Mode;
  rls?: {
    enabled?: boolean;
    varName?: string;
    probe?: boolean;
  };
  onWarn?: (warning: TenantGuardWarning) => void;
}

export interface TenantGuardWarning {
  code: 'INJECT_TENANT_FIELD' | 'INJECT_TENANT_WHERE';
  model: string;
  operation: string;
  path: string;
}

// Define SQL query types for better type safety
export interface SqlFragment {
  sql: string;
  values?: readonly unknown[];
}

// Minimal interface that matches what we need from Prisma clients
export interface PrismaClientLike {
  $extends: (extension: unknown) => unknown;
  $transaction?: {
    <T>(fn: (tx: PrismaTransactionClientLike) => Promise<T>): Promise<T>;
    <T extends readonly unknown[]>(arg: [...T]): Promise<T>;
  };
  $executeRaw?: (query: TemplateStringsArray | SqlFragment, ...values: unknown[]) => Promise<number>;
  $executeRawUnsafe?: (sql: string, ...values: unknown[]) => Promise<number>;
}

export interface PrismaTransactionClientLike {
  $extends?: (extension: unknown) => unknown;
  $executeRaw?: (query: TemplateStringsArray | SqlFragment, ...values: unknown[]) => Promise<number>;
  $executeRawUnsafe?: (sql: string, ...values: unknown[]) => Promise<number>;
}

export type TenantGuardErrorCode =
  | 'TENANT_FIELD_MISSING'
  | 'TENANT_MISMATCH'
  | 'TENANT_META_MISSING'
  | 'WHERE_TENANT_MISSING'
  | 'RLS_CLIENT_MISSING'
  | 'RLS_EXECUTOR_MISSING';

export interface TenantGuardErrorDetails {
  code: TenantGuardErrorCode;
  model: string;
  operation: string;
  path: string;
  expectedTenant: string;
  actualTenant?: unknown;
  meta?: TenantMetaModel;
}

export class TenantGuardError extends Error {
  readonly details: TenantGuardErrorDetails;

  constructor(message: string, details: TenantGuardErrorDetails) {
    super(message);
    this.name = 'TenantGuardError';
    this.details = details;
  }
}

interface GuardContext {
  tenantId: string;
  mode: Mode;
  meta: TenantMeta;
  rlsEnabled: boolean;
  onWarn?: (warning: TenantGuardWarning) => void;
}

interface EnforceArgs {
  model: string;
  operation: string;
  args: Record<string, unknown>;
}

const WRITE_OPERATIONS = new Set([
  'create',
  'createMany',
  'update',
  'updateMany',
  'upsert',
  'delete',
  'deleteMany',
]);

const RELATION_OPERATIONS = new Set([
  'create',
  'createMany',
  'connect',
  'connectOrCreate',
  'update',
  'updateMany',
  'upsert',
  'deleteMany',
  'set',
  'disconnect',
]);

const hasRelationOperations = (value: unknown): boolean => {
  if (Array.isArray(value)) {
    return value.some((item) => hasRelationOperations(item));
  }

  if (!value || typeof value !== 'object') {
    return false;
  }

  return Object.keys(value as Record<string, unknown>).some((key) =>
    RELATION_OPERATIONS.has(key),
  );
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const toPath = (base: string, segment: string) => (base ? `${base}.${segment}` : segment);

const toIndexPath = (base: string, index: number) => `${base}[${index}]`;

export function createTenantClient<T>(
  prisma: T,
  options: CreateTenantClientOptions,
): T {
  const prismaClient = asPrismaClientLike(prisma);
  if (!prismaClient || typeof prismaClient.$extends !== 'function') {
    throw new TenantGuardError('Prisma client does not expose $extends', {
      code: 'TENANT_META_MISSING',
      model: '$root',
      operation: '$init',
      path: '$client',
      expectedTenant: options.tenantId,
    });
  }

  const guard = new TenantGuard({
    tenantId: options.tenantId,
    mode: options.mode ?? 'strict',
    meta: options.meta,
    rlsEnabled: options.rls?.enabled ?? false,
    ...(options.onWarn ? { onWarn: options.onWarn } : {}),
  });

  return prismaClient.$extends({
    name: 'authzkitTenantGuard',
    query: {
      $allModels: {
        $allOperations(params: {
          model: string;
          operation: string;
          args: Record<string, unknown>;
          query: (args: Record<string, unknown>) => Promise<unknown>;
        }) {
          if (!WRITE_OPERATIONS.has(params.operation)) {
            return params.query(params.args);
          }

          const guardedArgs = guard.enforce({
            model: params.model,
            operation: params.operation,
            args: params.args,
          });

          return params.query(guardedArgs);
        },
      },
    },
  }) as T;
}

class TenantGuard {
  private readonly tenantId: string;
  private readonly mode: Mode;
  private readonly meta: TenantMeta;
  private readonly rlsEnabled: boolean;
  private readonly onWarn: ((warning: TenantGuardWarning) => void) | undefined;

  constructor(ctx: GuardContext) {
    this.tenantId = ctx.tenantId;
    this.mode = ctx.mode;
    this.meta = ctx.meta;
    this.rlsEnabled = ctx.rlsEnabled;
    this.onWarn = ctx.onWarn;
  }

  enforce({ model, operation, args }: EnforceArgs) {
    if (!isPlainObject(args)) {
      return args;
    }

    const pathRoot = model;

    switch (operation) {
      case 'create':
        this.ensureData(model, args.data, toPath(pathRoot, 'data'), {
          requireTenantField: true,
          allowRewrite: true,
          mutationKind: 'create',
        });
        break;
      case 'createMany':
        this.ensureCreateMany(model, args, pathRoot);
        break;
      case 'update':
      case 'delete':
        this.ensureWhere(model, args.where, toPath(pathRoot, 'where'), {
          allowRewrite: true,
          operation,
        });
        if (operation === 'update') {
          this.ensureData(model, args.data, toPath(pathRoot, 'data'), {
            requireTenantField: false,
            allowRewrite: false,
            mutationKind: 'update',
          });
        }
        break;
      case 'updateMany':
      case 'deleteMany':
        this.ensureWhere(model, args.where, toPath(pathRoot, 'where'), {
          allowRewrite: true,
          operation,
        });
        if (operation === 'updateMany') {
          this.ensureData(model, args.data, toPath(pathRoot, 'data'), {
            requireTenantField: false,
            allowRewrite: false,
            mutationKind: 'update',
          });
        }
        break;
      case 'upsert': {
        this.ensureWhere(model, args.where, toPath(pathRoot, 'where'), {
          allowRewrite: true,
          operation,
        });
        this.ensureData(model, args.create, toPath(pathRoot, 'create'), {
          requireTenantField: true,
          allowRewrite: true,
          mutationKind: 'create',
        });
        this.ensureData(model, args.update, toPath(pathRoot, 'update'), {
          requireTenantField: false,
          allowRewrite: false,
          mutationKind: 'update',
        });
        break;
      }
      default:
        break;
    }

    return args;
  }

  private ensureCreateMany(
    model: string,
    args: Record<string, unknown>,
    pathRoot: string,
  ) {
    const data = args.data;
    const path = toPath(pathRoot, 'data');
    if (Array.isArray(data)) {
      data.forEach((item, index) => {
        this.ensureData(model, item, toIndexPath(path, index), {
          requireTenantField: true,
          allowRewrite: true,
          mutationKind: 'create',
        });
      });
      return;
    }

    if (isPlainObject(data)) {
      const payload = data.data;
      if (Array.isArray(payload)) {
        payload.forEach((item, index) => {
          this.ensureData(model, item, toIndexPath(toPath(path, 'data'), index), {
            requireTenantField: true,
            allowRewrite: true,
            mutationKind: 'create',
          });
        });
      }
    }
  }

  private ensureData(
    model: string,
    rawValue: unknown,
    path: string,
    opts: {
      requireTenantField: boolean;
      allowRewrite: boolean;
      mutationKind: 'create' | 'update';
    },
  ) {
    if (Array.isArray(rawValue)) {
      rawValue.forEach((item, index) => {
        this.ensureData(model, item, toIndexPath(path, index), opts);
      });
      return;
    }

    if (!isPlainObject(rawValue)) {
      if (opts.requireTenantField) {
        throw this.error('TENANT_FIELD_MISSING', model, '$unknown', path, undefined);
      }
      return;
    }

    const value = rawValue as Record<string, unknown>;

    const tenantField = this.getTenantField(model);
    const presentTenant = value[tenantField];

    if (presentTenant === undefined) {
      if (opts.requireTenantField) {
        if (this.mode === 'assist' && opts.allowRewrite) {
          value[tenantField] = this.tenantId;
          this.warn({
            code: 'INJECT_TENANT_FIELD',
            model,
            operation: opts.mutationKind,
            path,
          });
        } else {
          throw this.error(
            'TENANT_FIELD_MISSING',
            model,
            opts.mutationKind,
            path,
            undefined,
          );
        }
      }
    } else if (presentTenant !== this.tenantId) {
      throw this.error('TENANT_MISMATCH', model, opts.mutationKind, path, presentTenant);
    }

    this.ensureNestedRelations(model, value, path);
  }

  private ensureNestedRelations(
    model: string,
    data: Record<string, unknown>,
    path: string,
  ) {
    const meta = this.meta[model];
    const nestedTargets = meta?.nestedTargets ?? {};

    for (const [relationField, nestedConfig] of Object.entries(nestedTargets)) {
      if (!(relationField in data)) {
        continue;
      }

      const relationValue = data[relationField];
      const relationPath = toPath(path, relationField);
      this.processRelationPayload(
        model,
        relationField,
        nestedConfig,
        relationValue,
        relationPath,
      );
    }

    if (this.mode === 'strict' && !this.rlsEnabled) {
      for (const [key, value] of Object.entries(data)) {
        if (key in nestedTargets) {
          continue;
        }

        if (hasRelationOperations(value)) {
          throw this.error(
            'TENANT_META_MISSING',
            model,
            key,
            toPath(path, key),
            undefined,
          );
        }
      }
    }
  }

  private processRelationPayload(
    parentModel: string,
    relationField: string,
    config: NestedTargetConfig | string,
    payload: unknown,
    path: string,
  ) {
    if (!isPlainObject(payload)) {
      if (Array.isArray(payload)) {
        payload.forEach((item, index) => {
          this.processRelationPayload(
            parentModel,
            relationField,
            config,
            item,
            toIndexPath(path, index),
          );
        });
      }
      return;
    }

    for (const [operation, value] of Object.entries(payload)) {
      if (!RELATION_OPERATIONS.has(operation)) {
        continue;
      }

      const targetModel = this.resolveTargetModel(
        parentModel,
        relationField,
        config,
        operation,
      );
      if (!targetModel) {
        if (this.mode === 'strict' && !this.rlsEnabled) {
          throw this.error(
            'TENANT_META_MISSING',
            parentModel,
            operation,
            path,
            undefined,
          );
        }
        continue;
      }

      const opPath = toPath(path, operation);

      switch (operation) {
        case 'create':
          this.ensureData(targetModel, value, opPath, {
            requireTenantField: true,
            allowRewrite: true,
            mutationKind: 'create',
          });
          break;
        case 'createMany':
          if (isPlainObject(value)) {
            const manyData = (value as Record<string, unknown>).data;
            this.ensureData(targetModel, manyData, toPath(opPath, 'data'), {
              requireTenantField: true,
              allowRewrite: true,
              mutationKind: 'create',
            });
          }
          break;
        case 'update':
        case 'updateMany':
          if (isPlainObject(value)) {
            const where = (value as Record<string, unknown>).where;
            const data = (value as Record<string, unknown>).data;
            if (where !== undefined) {
              this.ensureWhere(targetModel, where, toPath(opPath, 'where'), {
                allowRewrite: true,
                operation,
              });
            }
            if (data !== undefined) {
              this.ensureData(targetModel, data, toPath(opPath, 'data'), {
                requireTenantField: false,
                allowRewrite: false,
                mutationKind: 'update',
              });
            }
          }
          break;
        case 'upsert':
          if (isPlainObject(value)) {
            const where = (value as Record<string, unknown>).where;
            const create = (value as Record<string, unknown>).create;
            const update = (value as Record<string, unknown>).update;
            if (where !== undefined) {
              this.ensureWhere(targetModel, where, toPath(opPath, 'where'), {
                allowRewrite: true,
                operation,
              });
            }
            if (create !== undefined) {
              this.ensureData(targetModel, create, toPath(opPath, 'create'), {
                requireTenantField: true,
                allowRewrite: true,
                mutationKind: 'create',
              });
            }
            if (update !== undefined) {
              this.ensureData(targetModel, update, toPath(opPath, 'update'), {
                requireTenantField: false,
                allowRewrite: false,
                mutationKind: 'update',
              });
            }
          }
          break;
        case 'connect':
        case 'set':
        case 'disconnect':
          this.ensureConnectPayload(targetModel, value, opPath, operation);
          break;
        case 'connectOrCreate':
          this.ensureConnectOrCreate(targetModel, value, opPath);
          break;
        case 'deleteMany':
          if (Array.isArray(value)) {
            value.forEach((item, index) => {
              this.ensureWhere(targetModel, item, toIndexPath(opPath, index), {
                allowRewrite: false,
                operation,
              });
            });
          } else {
            this.ensureWhere(targetModel, value, opPath, {
              allowRewrite: false,
              operation,
            });
          }
          break;
        default:
          break;
      }
    }
  }

  private ensureConnectPayload(
    model: string,
    payload: unknown,
    path: string,
    operation: string,
  ) {
    if (Array.isArray(payload)) {
      payload.forEach((item, index) => {
        this.ensureConnectPayload(model, item, toIndexPath(path, index), operation);
      });
      return;
    }

    if (!isPlainObject(payload)) {
      throw this.error('TENANT_FIELD_MISSING', model, operation, path, undefined);
    }

    const compositeSelector = this.getCompositeSelector(model);
    const tenantField = this.getTenantField(model);

    if (payload[tenantField] !== undefined) {
      if (payload[tenantField] !== this.tenantId) {
        throw this.error('TENANT_MISMATCH', model, operation, path, payload[tenantField]);
      }
      return;
    }

    if (isPlainObject(payload.where)) {
      this.ensureWhere(model, payload.where, toPath(path, 'where'), {
        allowRewrite: true,
        operation,
      });
      return;
    }

    if (compositeSelector) {
      const composite = payload[compositeSelector];
      if (isPlainObject(composite)) {
        const tenantValue = (composite as Record<string, unknown>)[tenantField];
        if (tenantValue === undefined) {
          if (this.mode === 'assist') {
            (composite as Record<string, unknown>)[tenantField] = this.tenantId;
            this.warn({
              code: 'INJECT_TENANT_FIELD',
              model,
              operation,
              path: toPath(path, compositeSelector),
            });
            return;
          }
          throw this.error('TENANT_FIELD_MISSING', model, operation, path, undefined);
        }
        if (tenantValue !== this.tenantId) {
          throw this.error('TENANT_MISMATCH', model, operation, path, tenantValue);
        }
        return;
      }
    }

    if (this.mode === 'strict' && !this.rlsEnabled) {
      throw this.error('TENANT_META_MISSING', model, operation, path, undefined);
    }
  }

  private ensureConnectOrCreate(model: string, payload: unknown, path: string) {
    if (Array.isArray(payload)) {
      payload.forEach((item, index) => {
        this.ensureConnectOrCreate(model, item, toIndexPath(path, index));
      });
      return;
    }

    if (!isPlainObject(payload)) {
      throw this.error('TENANT_FIELD_MISSING', model, 'connectOrCreate', path, undefined);
    }

    const record = payload as Record<string, unknown>;
    if (record.where) {
      this.ensureWhere(model, record.where, toPath(path, 'where'), {
        allowRewrite: true,
        operation: 'connectOrCreate',
      });
    }
    if (record.create) {
      this.ensureData(model, record.create, toPath(path, 'create'), {
        requireTenantField: true,
        allowRewrite: true,
        mutationKind: 'create',
      });
    }
  }

  private ensureWhere(
    model: string,
    payload: unknown,
    path: string,
    opts: { allowRewrite: boolean; operation: string },
  ) {
    if (!isPlainObject(payload)) {
      throw this.error('WHERE_TENANT_MISSING', model, opts.operation, path, undefined);
    }

    const value = payload as Record<string, unknown>;
    const tenantField = this.getTenantField(model);
    const compositeSelector = this.getCompositeSelector(model);

    if (value[tenantField] === undefined) {
      if (compositeSelector && isPlainObject(value[compositeSelector])) {
        const composite = value[compositeSelector] as Record<string, unknown>;
        const compositeTenant = composite[tenantField];
        if (compositeTenant === undefined) {
          if (this.mode === 'assist' && opts.allowRewrite) {
            composite[tenantField] = this.tenantId;
            this.warn({
              code: 'INJECT_TENANT_WHERE',
              model,
              operation: opts.operation,
              path: toPath(path, compositeSelector),
            });
            return;
          }
          throw this.error(
            'WHERE_TENANT_MISSING',
            model,
            opts.operation,
            path,
            undefined,
          );
        }
        if (compositeTenant !== this.tenantId) {
          throw this.error(
            'TENANT_MISMATCH',
            model,
            opts.operation,
            path,
            compositeTenant,
          );
        }
        return;
      }

      if (this.mode === 'assist' && opts.allowRewrite) {
        value[tenantField] = this.tenantId;
        this.warn({
          code: 'INJECT_TENANT_WHERE',
          model,
          operation: opts.operation,
          path,
        });
        return;
      }

      throw this.error('WHERE_TENANT_MISSING', model, opts.operation, path, undefined);
    }

    if (value[tenantField] !== this.tenantId) {
      throw this.error(
        'TENANT_MISMATCH',
        model,
        opts.operation,
        path,
        value[tenantField],
      );
    }
  }

  private resolveTargetModel(
    parentModel: string,
    relationField: string,
    config: NestedTargetConfig | string,
    operation: string,
  ): string | undefined {
    if (typeof config === 'string') {
      return config;
    }

    const specific = config[operation];
    if (specific) {
      return specific;
    }

    if (config.$default) {
      return config.$default;
    }

    const meta = this.meta[parentModel];
    if (!meta?.nestedTargets?.[relationField]) {
      return undefined;
    }

    return undefined;
  }

  private getTenantField(model: string): string {
    return this.meta[model]?.tenantField ?? 'tenantId';
  }

  private getCompositeSelector(model: string): string | undefined {
    return this.meta[model]?.compositeSelector;
  }

  private warn(warning: TenantGuardWarning) {
    if (this.onWarn) {
      this.onWarn(warning);
    }
  }

  private error(
    code: TenantGuardErrorCode,
    model: string,
    operation: string,
    path: string,
    actualTenant: unknown,
  ) {
    const meta = this.meta[model];
    return new TenantGuardError(this.messageFor(code, model, operation, path), {
      code,
      model,
      operation,
      path,
      expectedTenant: this.tenantId,
      actualTenant,
      ...(meta ? { meta } : {}),
    });
  }

  private messageFor(
    code: TenantGuardErrorCode,
    model: string,
    operation: string,
    path: string,
  ): string {
    switch (code) {
      case 'TENANT_FIELD_MISSING':
        return `Tenant guard: missing tenant field for ${model}.${operation} at ${path}`;
      case 'TENANT_MISMATCH':
        return `Tenant guard: tenant mismatch for ${model}.${operation} at ${path}`;
      case 'TENANT_META_MISSING':
        return `Tenant guard: metadata missing for ${model}.${operation} at ${path}`;
      case 'WHERE_TENANT_MISSING':
        return `Tenant guard: where clause missing tenant constraint for ${model}.${operation} at ${path}`;
      case 'RLS_CLIENT_MISSING':
        return 'Tenant guard: Prisma client missing $transaction for RLS wrapper';
      case 'RLS_EXECUTOR_MISSING':
        return 'Tenant guard: Prisma client missing $executeRaw/$executeRawUnsafe for RLS wrapper';
      default:
        return `Tenant guard violation for ${model}.${operation} at ${path}`;
    }
  }
}

// Helper function to safely convert Prisma client to our interface
export function asPrismaClientLike(client: unknown): PrismaClientLike {
  return client as PrismaClientLike;
}

export async function withTenantRLS<T>(
  prisma: unknown,
  tenantId: string,
  run: (tx: PrismaTransactionClientLike) => Promise<T>,
  varName = 'authzkit.tenant_id',
): Promise<T> {
  const prismaClient = asPrismaClientLike(prisma);
  if (!prismaClient.$transaction) {
    throw new TenantGuardError('Prisma client does not support $transaction', {
      code: 'RLS_CLIENT_MISSING',
      model: '$root',
      operation: 'withTenantRLS',
      path: '$transaction',
      expectedTenant: tenantId,
    });
  }

  return (
    prismaClient.$transaction as (
      fn: (tx: PrismaTransactionClientLike) => Promise<T>,
    ) => Promise<T>
  )(async (tx) => {
    const executeRawUnsafe = (tx as { $executeRawUnsafe?: unknown }).$executeRawUnsafe;
    const executeRaw = (tx as { $executeRaw?: unknown }).$executeRaw;

    const executor = executeRawUnsafe ?? executeRaw;

    if (!executor) {
      throw new TenantGuardError('Prisma client does not expose $executeRaw for RLS', {
        code: 'RLS_EXECUTOR_MISSING',
        model: '$root',
        operation: 'withTenantRLS',
        path: '$executeRaw',
        expectedTenant: tenantId,
      });
    }

    if (executeRawUnsafe && executor === executeRawUnsafe) {
      await (
        executeRawUnsafe as (query: string, ...values: unknown[]) => Promise<unknown>
      )(`select set_config('${varName}', $1, true)`, tenantId);
    } else if (executeRaw && executor === executeRaw) {
      await (executeRaw as (query: string, ...values: unknown[]) => Promise<unknown>)(
        `select set_config('${varName}', $1, true)`,
        tenantId,
      );
    }

    return run(tx);
  });
}

// Helper to create Prisma extension with tenant guard functionality
export function tenantGuardExtension(options: CreateTenantClientOptions) {
  const guard = new TenantGuard({
    tenantId: options.tenantId,
    mode: options.mode ?? 'strict',
    meta: options.meta,
    rlsEnabled: options.rls?.enabled ?? false,
    ...(options.onWarn ? { onWarn: options.onWarn } : {}),
  });

  return {
    name: 'authzkitTenantGuard',
    query: {
      $allModels: {
        $allOperations(params: {
          model: string;
          operation: string;
          args: Record<string, unknown>;
          query: (args: Record<string, unknown>) => Promise<unknown>;
        }) {
          if (!WRITE_OPERATIONS.has(params.operation)) {
            return params.query(params.args);
          }

          const guardedArgs = guard.enforce({
            model: params.model,
            operation: params.operation,
            args: params.args,
          });

          return params.query(guardedArgs);
        },
      },
    },
  };
}

// Helper to create write mask extension for model operations
export function createWriteMaskExtension<T extends Record<string, unknown>>(
  maskFunctions: T,
) {
  return {
    name: 'authzkitWriteMask',
    model: maskFunctions,
  };
}
