import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  createTenantClient,
  TenantGuardError,
  type CreateTenantClientOptions,
  type Mode,
  type TenantMeta
} from './index.js';

export interface TenantGuardCliOptions {
  cwd?: string;
  configPath?: string;
  mode?: Mode;
  silent?: boolean;
}

export interface TenantGuardCliResult {
  status: 'ok' | 'error';
  command: string;
  messages: string[];
}

interface ParsedArgs {
  command: string;
  flags: Record<string, string | boolean>;
  positionals: string[];
}

interface TenantGuardConfig extends CreateTenantClientOptions {
  metaFile?: string;
  schemaPath?: string;
}

export async function runTenantGuardCli(
  argv: string[],
  options: TenantGuardCliOptions = {},
): Promise<TenantGuardCliResult> {
  const parsed = parseArgs(argv);

  if (parsed.flags.help === true) {
    return emitResult(
      'ok',
      parsed.command,
      [
        'Usage: authzkit-tenant-guard <command> [--config <path>] [--mode <mode>]',
        '',
        'Commands: check | plan | rls | smoke',
      ],
      options,
    );
  }

  const cwd = options.cwd ?? process.cwd();
  const configPath = resolve(
    cwd,
    (parsed.flags.config as string | undefined) ??
      options.configPath ??
      'tenant-guard.config.json',
  );

  let config: TenantGuardConfig;

  try {
    config = await loadConfig(configPath);
  } catch (error) {
    return emitResult(
      'error',
      parsed.command,
      [formatError(error, `Failed to read config at ${configPath}`)],
      options,
    );
  }

  if (parsed.flags.mode && typeof parsed.flags.mode === 'string') {
    config.mode = parsed.flags.mode as Mode;
  }

  if (options.mode) {
    config.mode = options.mode;
  }

  if (parsed.flags.tenant && typeof parsed.flags.tenant === 'string') {
    config.tenantId = parsed.flags.tenant;
  }

  const command = parsed.command ?? 'check';

  try {
    switch (command) {
      case 'check':
        return emitResult('ok', 'check', runCheck(config), options);
      case 'plan':
        return emitResult('ok', 'plan', runPlan(config), options);
      case 'rls':
        return emitResult('ok', 'rls', runRls(config), options);
      case 'smoke':
        return emitResult('ok', 'smoke', await runSmoke(config), options);
      default:
        return emitResult('error', command, [`Unknown command: ${command}`], options);
    }
  } catch (error) {
    if (error instanceof TenantGuardError) {
      return emitResult('error', command, [formatError(error)], options);
    }

    return emitResult(
      'error',
      command,
      [formatError(error, 'Unexpected error')],
      options,
    );
  }
}

function runCheck(config: TenantGuardConfig): string[] {
  const messages: string[] = [];
  const errors: string[] = [];

  if (typeof config.tenantId !== 'string' || config.tenantId.length === 0) {
    errors.push('tenantId must be a non-empty string');
  }

  if (!config.meta || Object.keys(config.meta).length === 0) {
    errors.push('meta must define at least one model');
  }

  for (const [model, modelMeta] of Object.entries(config.meta ?? {})) {
    const tenantField = modelMeta.tenantField ?? 'tenantId';
    if (tenantField.length === 0) {
      errors.push(`${model}: tenantField must be a non-empty string`);
    }

    if (modelMeta.nestedTargets) {
      for (const [relation, target] of Object.entries(modelMeta.nestedTargets)) {
        const candidate = resolveNestedTarget(config.meta, target, 'create');
        if (!candidate) {
          errors.push(
            `${model}.${relation}: nested target does not resolve to a known model`,
          );
        }
      }
    }
  }

  const mode = config.mode ?? 'strict';
  const rlsEnabled = config.rls?.enabled === true;

  if (mode === 'strict' && !rlsEnabled) {
    errors.push('strict mode requires rls.enabled=true to guarantee tenant isolation');
  }

  if (rlsEnabled) {
    const varName = config.rls?.varName ?? 'authzkit.tenant_id';
    if (!varName || typeof varName !== 'string' || varName.trim().length === 0) {
      errors.push('rls.varName must be a non-empty string when RLS is enabled');
    }

    const missingComposite = Object.entries(config.meta ?? {}).filter(
      ([, meta]) => !meta.compositeSelector,
    );
    if (missingComposite.length > 0) {
      errors.push(
        `rls.enabled requires compositeSelector for: ${missingComposite.map(([name]) => name).join(', ')}`,
      );
    }
  }

  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }

  messages.push(`tenantId: ${config.tenantId}`);
  messages.push(`mode: ${mode}`);
  messages.push(`models: ${Object.keys(config.meta ?? {}).join(', ')}`);
  if (config.metaFile) {
    messages.push(`meta source: ${config.metaFile}`);
  }

  return messages;
}

function runPlan(config: TenantGuardConfig): string[] {
  const lines: string[] = [];
  lines.push(`Plan for tenant guard enforcement (mode: ${config.mode ?? 'strict'})`);

  for (const [model, modelMeta] of Object.entries(config.meta ?? {})) {
    const tenantField = modelMeta.tenantField ?? 'tenantId';
    let header = `- ${model}: tenant field → ${tenantField}`;
    if (modelMeta.compositeSelector) {
      header += `, composite selector → ${modelMeta.compositeSelector}`;
    } else {
      header += ', composite selector ✖';
    }
    lines.push(header);
    if (modelMeta.nestedTargets) {
      const nestedLines: string[] = [];
      for (const [relation, target] of Object.entries(modelMeta.nestedTargets)) {
        const createTarget = resolveNestedTarget(config.meta, target, 'create');
        if (createTarget) {
          nestedLines.push(`  • ${relation}.create → ${createTarget}`);
        }
        const updateTarget = resolveNestedTarget(config.meta, target, 'update');
        if (updateTarget && updateTarget !== createTarget) {
          nestedLines.push(`  • ${relation}.update → ${updateTarget}`);
        }
      }
      if (nestedLines.length > 0) {
        lines.push(...nestedLines);
      }
    }
  }

  if (config.rls?.enabled) {
    lines.push(`RLS enabled with var ${config.rls.varName ?? 'authzkit.tenant_id'}`);
  }

  return lines;
}

function runRls(config: TenantGuardConfig): string[] {
  if (!config.rls?.enabled) {
    return ['RLS is disabled. Enable via rls.enabled in config.'];
  }

  const varName = config.rls.varName ?? 'authzkit.tenant_id';
  const lines = [
    'Row-level security guidance:',
    `- Ensure each table has policies referencing current_setting('${varName}')`,
    `- Wrap mutations using withTenantRLS(prisma, tenantId, fn, '${varName}')`,
    `- Example policy: USING (tenant_id = current_setting('${varName}')::text)`,
  ];

  const missingComposite = Object.entries(config.meta ?? {}).filter(
    ([, meta]) => !meta.compositeSelector,
  );
  if (missingComposite.length > 0) {
    lines.push(
      `- Missing composite selectors for: ${missingComposite.map(([name]) => name).join(', ')}`,
    );
  }

  return lines;
}

async function runSmoke(config: TenantGuardConfig): Promise<string[]> {
  const messages: string[] = [];

  const fake = new FakePrisma();
  const guarded = createTenantClient(fake, config);
  const client = guarded as unknown as GuardedFakePrisma;

  const okPayload = {
    model: 'Post',
    operation: 'create',
    args: { data: { tenantId: config.tenantId } },
  };

  await client.__execute(okPayload);
  messages.push('✔ create with matching tenant allowed');

  const badPayload = {
    model: 'Post',
    operation: 'create',
    args: { data: { tenantId: `${config.tenantId}-other` } },
  };

  let rejected = false;
  try {
    await client.__execute(badPayload);
  } catch (error) {
    if (error instanceof TenantGuardError) {
      rejected = true;
      messages.push(`✔ cross-tenant create rejected (${error.details.code})`);
    } else {
      throw error;
    }
  }

  if (!rejected) {
    throw new Error('Cross-tenant create was not rejected');
  }

  return messages;
}

function resolveNestedTarget(
  meta: TenantMeta,
  target: NestedTargetLike,
  operation: string,
): string | undefined {
  if (typeof target === 'string') {
    return meta[target] ? target : undefined;
  }

  const record = target as Record<string, string | undefined> & { $default?: string };

  if (record.$default && meta[record.$default]) {
    return record.$default;
  }

  const opTarget = record[operation];
  if (opTarget && meta[opTarget]) {
    return opTarget;
  }

  return undefined;
}

type NestedTargetLike =
  | string
  | ({ $default?: string } & Record<string, string | undefined>);

async function loadConfig(configPath: string): Promise<TenantGuardConfig> {
  const absoluteConfigPath = resolve(configPath);
  const configDir = dirname(absoluteConfigPath);
  const content = await readFile(absoluteConfigPath, 'utf8');
  const parsed = JSON.parse(content) as TenantGuardConfig;

  if (!parsed.tenantId || typeof parsed.tenantId !== 'string') {
    throw new Error('Config must include tenantId');
  }

  let meta = parsed.meta;

  if (!meta && parsed.metaFile) {
    const metaPath = resolve(configDir, parsed.metaFile);
    meta = await loadMetaFile(metaPath);
    parsed.metaFile = metaPath;
  }

  if (!meta) {
    throw new Error('Config must include meta or metaFile');
  }

  parsed.meta = validateMeta(meta, parsed.metaFile ?? 'inline meta');

  return parsed;
}

async function loadMetaFile(metaPath: string): Promise<TenantMeta> {
  if (metaPath.endsWith('.json')) {
    const raw = await readFile(metaPath, 'utf8');
    try {
      return JSON.parse(raw) as TenantMeta;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to parse meta JSON at ${metaPath}: ${reason}`);
    }
  }

  if (metaPath.endsWith('.ts')) {
    throw new Error(
      `Cannot import TypeScript meta file (${metaPath}). Compile to JS or generate JSON.`,
    );
  }

  if (
    metaPath.endsWith('.js') ||
    metaPath.endsWith('.mjs') ||
    metaPath.endsWith('.cjs')
  ) {
    const mod = await import(pathToFileURL(metaPath).href);
    const candidate = mod.default ?? mod.meta ?? mod.tenantMeta;
    if (!candidate) {
      throw new Error(
        `Meta module at ${metaPath} does not export default/meta/tenantMeta`,
      );
    }
    return candidate as TenantMeta;
  }

  throw new Error(`Unsupported meta file extension: ${metaPath}`);
}

function validateMeta(meta: unknown, source: string): TenantMeta {
  if (!meta || typeof meta !== 'object') {
    throw new Error(`Meta from ${source} must be an object`);
  }
  return meta as TenantMeta;
}

function parseArgs(argv: string[]): ParsedArgs {
  const args = [...argv];
  const flags: Record<string, string | boolean> = {};
  const positionals: string[] = [];
  let command: string | undefined;

  while (args.length > 0) {
    const token = args.shift();
    if (!token) {
      continue;
    }

    if (token.startsWith('--')) {
      const body = token.slice(2);
      if (!body) {
        continue;
      }

      const eqIndex = body.indexOf('=');
      if (eqIndex !== -1) {
        const key = body.slice(0, eqIndex);
        const value = body.slice(eqIndex + 1);
        if (key) {
          flags[key] = value;
        }
        continue;
      }

      const name = body;
      if (name === 'help') {
        flags.help = true;
        continue;
      }

      const peek = args[0];
      if (peek && !peek.startsWith('-')) {
        const value = args.shift();
        if (value !== undefined) {
          flags[name] = value;
        }
      } else {
        flags[name] = true;
      }
      continue;
    }

    if (token.startsWith('-') && token.length > 1) {
      const name = token.slice(1);
      const peek = args[0];
      if (peek && !peek.startsWith('-')) {
        const value = args.shift();
        if (value !== undefined) {
          flags[name] = value;
        }
      } else {
        flags[name] = true;
      }
      continue;
    }

    if (!command) {
      command = token;
      continue;
    }

    positionals.push(token);
  }

  return {
    command: command ?? 'check',
    flags,
    positionals,
  };
}

function emitResult(
  status: 'ok' | 'error',
  command: string,
  messages: string[],
  options: TenantGuardCliOptions,
): TenantGuardCliResult {
  if (!options.silent) {
    for (const line of messages) {
      console.log(line);
    }
  }

  return { status, command, messages };
}

function formatError(error: unknown, prefix?: string): string {
  if (error instanceof Error) {
    if (error instanceof TenantGuardError) {
      const detail = error.details;
      return `${prefix ? `${prefix}: ` : ''}${error.message} [${detail.code} at ${detail.path}]`;
    }
    return `${prefix ? `${prefix}: ` : ''}${error.message}`;
  }
  return `${prefix ? `${prefix}: ` : ''}${String(error)}`;
}

interface GuardHandlerPayload {
  model: string;
  operation: string;
  args: Record<string, unknown>;
  query: (args: Record<string, unknown>) => Promise<unknown>;
}

type GuardHandler = (payload: GuardHandlerPayload) => Promise<unknown>;

class FakePrisma {
  $extends(extension: unknown): FakePrisma {
    if (!extension || typeof extension !== 'object') {
      throw new Error('Invalid extension passed to FakePrisma');
    }

    const query = (extension as Record<string, unknown>).query;
    if (!query || typeof query !== 'object') {
      throw new Error('Extension missing query handler');
    }

    const allModels = (query as Record<string, unknown>).$allModels;
    if (!allModels || typeof allModels !== 'object') {
      throw new Error('Extension missing $allModels');
    }

    const handler = (allModels as { $allOperations?: GuardHandler }).$allOperations;
    if (typeof handler !== 'function') {
      throw new Error('Extension missing $allOperations handler');
    }

    return new GuardedFakePrisma(handler);
  }
}

class GuardedFakePrisma extends FakePrisma {
  private readonly handler: GuardHandler;

  constructor(handler: GuardHandler) {
    super();
    this.handler = handler;
  }

  async __execute(payload: {
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
