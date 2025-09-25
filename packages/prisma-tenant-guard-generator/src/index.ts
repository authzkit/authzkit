import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import type { DMMF } from '@prisma/generator-helper';
import { getDMMF } from '@prisma/internals';

import type { TenantMeta } from '@authzkit/prisma-tenant-guard';

// Create a function to safely convert deeply nested readonly types to DMMF.Model
// This uses JSON serialization to strip readonly modifiers and deep nesting
function normalizeModel(model: unknown): DMMF.Model {
  // Use JSON serialization to strip readonly modifiers while preserving structure
  const serialized = JSON.stringify(model);
  const parsed = JSON.parse(serialized);

  // Type assertion to DMMF.Model after normalization
  return parsed as DMMF.Model;
}

export interface GenerateTenantMetaOptions {
  schemaPath: string;
  outputPath?: string;
  emitTs?: boolean;
  jsonOutputPath?: string;
  emitJson?: boolean;
  tenantField?: string;
  include?: string[];
  exclude?: string[];
}

export interface GenerateTenantMetaResult {
  meta: TenantMeta;
  writtenTo?: string;
  artifacts?: {
    ts?: string;
    json?: string;
  };
}

interface CandidateRelation {
  fieldName: string;
  targetModel: string;
}

interface CandidateModel {
  name: string;
  tenantField: string;
  compositeSelector?: string;
  relations: CandidateRelation[];
}

export async function generateTenantMeta(
  options: GenerateTenantMetaOptions,
): Promise<GenerateTenantMetaResult> {
  const schemaPath = resolve(options.schemaPath);
  const datamodel = await readFile(schemaPath, 'utf8');
  const dmmf = await getDMMF({ datamodel });

  const tenantFieldCandidates = (options.tenantField ?? 'tenantId')
    .split(',')
    .map((field) => field.trim())
    .filter(Boolean);
  if (tenantFieldCandidates.length === 0) {
    tenantFieldCandidates.push('tenantId');
  }
  const includeSet = options.include ? new Set(options.include) : undefined;
  const excludeSet = options.exclude ? new Set(options.exclude) : undefined;

  const candidates: CandidateModel[] = [];

  for (const model of dmmf.datamodel.models) {
    if (includeSet && !includeSet.has(model.name)) {
      continue;
    }
    if (excludeSet && excludeSet.has(model.name)) {
      continue;
    }

    const tenantField = model.fields.find(
      (field) => field.kind === 'scalar' && tenantFieldCandidates.includes(field.name),
    );
    if (!tenantField) {
      continue;
    }

    const normalizedModel = normalizeModel(model);
    const compositeSelector = detectCompositeSelector(normalizedModel, tenantField.name);
    const relations: CandidateRelation[] = [];

    for (const field of model.fields) {
      if (field.kind !== 'object') {
        continue;
      }
      if (!field.type || typeof field.type !== 'string') {
        continue;
      }

      relations.push({ fieldName: field.name, targetModel: field.type });
    }

    const candidate: CandidateModel = {
      name: model.name,
      tenantField: tenantField.name,
      relations,
    };

    if (compositeSelector) {
      candidate.compositeSelector = compositeSelector;
    }

    candidates.push(candidate);
  }

  const candidateByName = new Map(
    candidates.map((candidate) => [candidate.name, candidate] as const),
  );
  const meta: TenantMeta = {};

  for (const candidate of candidates) {
    const nestedTargets: Record<string, string> = {};

    for (const relation of candidate.relations) {
      if (!candidateByName.has(relation.targetModel)) {
        continue;
      }
      if (relation.targetModel === candidate.name) {
        nestedTargets[relation.fieldName] = relation.targetModel;
        continue;
      }

      nestedTargets[relation.fieldName] = relation.targetModel;
    }

    meta[candidate.name] = {
      tenantField: candidate.tenantField,
      ...(candidate.compositeSelector
        ? { compositeSelector: candidate.compositeSelector }
        : {}),
      ...(Object.keys(nestedTargets).length > 0 ? { nestedTargets } : {}),
    };
  }

  const artifacts: { ts?: string; json?: string } = {};

  if (options.outputPath && options.emitTs !== false) {
    artifacts.ts = await writeMetaFile(meta, options.outputPath);
  }

  if (options.emitJson) {
    const inferredJsonPath = options.outputPath
      ? replaceExtension(options.outputPath, '.json')
      : undefined;
    const jsonPath = resolve(
      options.jsonOutputPath ?? inferredJsonPath ?? 'tenant-guard.meta.json',
    );
    artifacts.json = await writeMetaJson(meta, jsonPath);
  }

  const result: GenerateTenantMetaResult = { meta, artifacts };
  const writtenTo = artifacts.ts ?? artifacts.json;
  if (writtenTo) {
    result.writtenTo = writtenTo;
  }

  return result;
}

function detectCompositeSelector(
  model: DMMF.Model,
  tenantField: string,
): string | undefined {
  for (const index of model.uniqueIndexes ?? []) {
    if (index.fields.includes(tenantField) && index.fields.length > 1) {
      return index.name ?? index.fields.join('_');
    }
  }

  for (const uniqueFields of model.uniqueFields ?? []) {
    if (uniqueFields.includes(tenantField) && uniqueFields.length > 1) {
      return uniqueFields.join('_');
    }
  }

  const primaryFields = model.primaryKey?.fields ?? [];
  if (primaryFields.includes(tenantField) && primaryFields.length > 1) {
    return (model.primaryKey?.name ?? primaryFields.join('_')) || undefined;
  }

  return undefined;
}

export async function writeMetaFile(
  meta: TenantMeta,
  outputPath: string,
): Promise<string> {
  const filePath = resolve(outputPath);
  const outputDir = dirname(filePath);
  await mkdir(outputDir, { recursive: true });

  const contents = formatMeta(meta);
  await writeFile(filePath, contents, 'utf8');
  return filePath;
}

export async function writeMetaJson(
  meta: TenantMeta,
  outputPath: string,
): Promise<string> {
  const filePath = resolve(outputPath);
  const outputDir = dirname(filePath);
  await mkdir(outputDir, { recursive: true });
  await writeFile(filePath, JSON.stringify(meta, null, 2) + '\n', 'utf8');
  return filePath;
}

export function formatMeta(meta: TenantMeta): string {
  const lines: string[] = [];
  lines.push("import type { TenantMeta } from '@authzkit/prisma-tenant-guard';");
  lines.push('');
  lines.push(
    'export const tenantMeta = ' + serializeMeta(meta) + ' satisfies TenantMeta;',
  );
  lines.push('');
  lines.push('export default tenantMeta;');
  lines.push('');
  return lines.join('\n');
}

function serializeMeta(meta: TenantMeta): string {
  const entries = Object.entries(meta).sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) {
    return '{}';
  }

  const indent = (level: number) => '  '.repeat(level);
  const lines: string[] = ['{'];

  for (const [model, config] of entries) {
    const modelLines: string[] = [];

    if (config.tenantField) {
      modelLines.push(`${indent(2)}tenantField: '${config.tenantField}',`);
    }
    if (config.compositeSelector) {
      modelLines.push(`${indent(2)}compositeSelector: '${config.compositeSelector}',`);
    }
    if (config.nestedTargets && Object.keys(config.nestedTargets).length > 0) {
      modelLines.push(`${indent(2)}nestedTargets: {`);
      const nestedEntries = Object.entries(config.nestedTargets).sort(([a], [b]) =>
        a.localeCompare(b),
      );
      for (const [field, target] of nestedEntries) {
        if (typeof target === 'string') {
          modelLines.push(`${indent(3)}${field}: '${target}',`);
          continue;
        }

        const targetLines: string[] = [`${indent(3)}${field}: {`];
        const entries = Object.entries(target).sort(([a], [b]) => a.localeCompare(b));
        for (const [key, value] of entries) {
          targetLines.push(`${indent(4)}${key}: '${value}',`);
        }
        targetLines.push(`${indent(3)}}`);
        modelLines.push(...targetLines);
      }
      modelLines.push(`${indent(2)}},`);
    }

    if (modelLines.length === 0) {
      lines.push(`${indent(1)}${model}: {},`);
      continue;
    }

    lines.push(`${indent(1)}${model}: {`);
    lines.push(...modelLines);
    lines.push(`${indent(1)}},`);
  }

  lines.push('}');
  return lines.join('\n');
}

function replaceExtension(path: string, nextExtension: string): string {
  const resolved = resolve(path);
  const lastDot = resolved.lastIndexOf('.');
  if (lastDot === -1) {
    return `${resolved}${nextExtension}`;
  }
  return `${resolved.slice(0, lastDot)}${nextExtension}`;
}
