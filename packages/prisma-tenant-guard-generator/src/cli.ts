import { realpathSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import kleur from 'kleur';

import { formatMeta, generateTenantMeta } from './index.js';
import type { GenerateTenantMetaOptions } from './index.js';

interface CliFlags {
  help?: boolean;
  schema?: string;
  out?: string;
  tenantField?: string;
  include?: string[];
  exclude?: string[];
  print?: boolean;
  tsOnly?: boolean;
  jsonOnly?: boolean;
}

interface ParsedArgs {
  flags: CliFlags;
}

export async function run(argv = process.argv.slice(2)) {
  const parsed = parseArgs(argv);
  if (parsed.flags.help) {
    printHelp();
    return { status: 'ok' as const };
  }

  const cwd = process.cwd();
  const schemaPath = resolve(cwd, parsed.flags.schema ?? defaultSchemaPath(cwd));
  const schemaDir = dirname(schemaPath);
  const defaultOutput = resolve(schemaDir, '..', '.prisma', 'tenant-guard', 'meta.ts');
  const outputPath = resolve(cwd, parsed.flags.out ?? defaultOutput);

  const include = parsed.flags.include ?? [];
  const exclude = parsed.flags.exclude ?? [];

  try {
    const generationOptions: GenerateTenantMetaOptions = { schemaPath };

    if (parsed.flags.tenantField) {
      generationOptions.tenantField = parsed.flags.tenantField;
    }
    if (include.length > 0) {
      generationOptions.include = include;
    }
    if (exclude.length > 0) {
      generationOptions.exclude = exclude;
    }

    const emitTs = !parsed.flags.print && !parsed.flags.jsonOnly;
    if (emitTs) {
      generationOptions.outputPath = outputPath;
    } else if (parsed.flags.jsonOnly) {
      generationOptions.emitTs = false;
    }

    const shouldEmitJson = !parsed.flags.print && !parsed.flags.tsOnly;
    if (shouldEmitJson) {
      generationOptions.emitJson = true;
      if (parsed.flags.jsonOnly) {
        generationOptions.jsonOutputPath = resolve(
          cwd,
          parsed.flags.out ?? defaultOutput.replace(/\.ts$/, '.json'),
        );
      }
    }

    const result = await generateTenantMeta(generationOptions);

    if (parsed.flags.print) {
      process.stdout.write(formatMeta(result.meta));
      return { status: 'ok' as const };
    }

    const models = Object.keys(result.meta);
    const artifactParts: string[] = [];
    if (result.artifacts?.ts) {
      artifactParts.push(`${kleur.cyan(result.artifacts.ts)} (.ts)`);
    }
    if (result.artifacts?.json) {
      artifactParts.push(`${kleur.magenta(result.artifacts.json)} (.json)`);
    }
    const artifactsSummary =
      artifactParts.length > 0 ? artifactParts.join(', ') : 'stdout';
    console.log(
      kleur.green('✔'),
      `Generated tenant guard meta for ${kleur.bold(String(models.length))} models -> ${artifactsSummary}`,
    );
    return { status: 'ok' as const, models: result.meta };
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    console.error(kleur.red('✖'), 'Failed to generate tenant guard meta');
    console.error(kleur.gray(details));
    return { status: 'error' as const, error };
  }
}

function defaultSchemaPath(cwd: string): string {
  return resolve(cwd, 'prisma/schema.prisma');
}

function parseArgs(argv: string[]): ParsedArgs {
  const flags: CliFlags = {};
  const pending: Record<string, true | undefined> = {};

  for (const token of argv) {
    if (token.startsWith('--')) {
      const [rawKey, rawValue] = token.includes('=')
        ? token.slice(2).split('=', 2)
        : [token.slice(2), undefined];
      const key = rawKey.trim();
      if (key === 'help') {
        flags.help = true;
        continue;
      }
      if (key === 'print') {
        flags.print = true;
        continue;
      }
      if (key === 'ts-only') {
        flags.tsOnly = true;
        continue;
      }
      if (key === 'json-only') {
        flags.jsonOnly = true;
        continue;
      }
      if (rawValue !== undefined) {
        setFlag(flags, key, rawValue);
        continue;
      }
      pending[key] = true;
      continue;
    }

    if (token.startsWith('-')) {
      const key = token.slice(1);
      if (key === 'h') {
        flags.help = true;
        continue;
      }
      pending[key] = true;
      continue;
    }

    const pendingKey = Object.keys(pending)[0];
    if (pendingKey) {
      setFlag(flags, pendingKey, token);
      delete pending[pendingKey];
    }
  }

  return { flags };
}

function setFlag(flags: CliFlags, key: string, value: string) {
  switch (key) {
    case 'schema':
    case 's':
      flags.schema = value;
      break;
    case 'out':
    case 'output':
    case 'o':
      flags.out = value;
      break;
    case 'tenant-field':
    case 'tenantField':
    case 't':
      flags.tenantField = value;
      break;
    case 'include':
    case 'includes':
    case 'i':
      flags.include = [
        ...(flags.include ?? []),
        ...value
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      ];
      break;
    case 'exclude':
    case 'excludes':
    case 'e':
      flags.exclude = [
        ...(flags.exclude ?? []),
        ...value
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      ];
      break;
    default:
      break;
  }
}

function printHelp() {
  const banner = kleur.bold('AuthzKit Prisma Tenant Guard Generator');
  const usage = kleur.cyan('authzkit-tenant-guard-gen [options]');
  const lines = [
    banner,
    '',
    `Usage: ${usage}`,
    '',
    'Options:',
    '  --schema <path>        Path to schema.prisma (default: prisma/schema.prisma)',
    '  --out <path>           Output file (default: ../.prisma/tenant-guard/meta.ts)',
    '  --tenant-field <name>  Tenant field to detect (default: tenantId)',
    '  --include <Model[,..]> Only emit metadata for specific models',
    '  --exclude <Model[,..]> Skip metadata for specific models',
    '  --print                Print generated meta to stdout instead of writing to disk',
    '  --ts-only              Emit only the TypeScript artifact',
    '  --json-only            Emit only the JSON artifact',
    '  --help                 Show this help message',
    '',
  ];

  console.log(lines.join('\n'));
}

if (isMainModule()) {
  void run().then((result) => {
    if (result.status === 'error') {
      process.exitCode = 1;
    }
  });
}

function isMainModule(): boolean {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }

  try {
    const resolvedEntry = realpathSync(entry);
    const modulePath = realpathSync(fileURLToPath(import.meta.url));
    return resolvedEntry === modulePath;
  } catch {
    const resolvedModule = fileURLToPath(import.meta.url);
    return entry === resolvedModule;
  }
}
