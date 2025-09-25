import pkg from '@prisma/generator-helper';
const { generatorHandler } = pkg;
import type { GeneratorOptions, DMMF } from '@prisma/generator-helper';
import { resolve } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { TenantMeta } from '@authzkit/prisma-tenant-guard';

interface CandidateModel {
  name: string;
  tenantField: string;
  compositeSelector?: string;
  relations: Array<{ fieldName: string; targetModel: string }>;
}

function detectCompositeSelector(model: DMMF.Model, tenantField: string): string | undefined {
  // Check unique indexes
  for (const index of model.uniqueIndexes ?? []) {
    if (index.fields.includes(tenantField) && index.fields.length > 1) {
      return index.name ?? index.fields.join('_');
    }
  }

  // Check primary key
  const primaryFields = model.primaryKey?.fields ?? [];
  if (primaryFields.includes(tenantField) && primaryFields.length > 1) {
    return (model.primaryKey?.name ?? primaryFields.join('_')) || undefined;
  }

  return undefined;
}

function formatMeta(meta: TenantMeta): string {
  const lines: string[] = [];
  lines.push("import type { TenantMeta } from '@authzkit/prisma-tenant-guard';");
  lines.push('');
  lines.push('export const tenantMeta = ' + serializeMeta(meta) + ' satisfies TenantMeta;');
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
      const nestedEntries = Object.entries(config.nestedTargets).sort(([a], [b]) => a.localeCompare(b));
      for (const [field, target] of nestedEntries) {
        const targetValue = typeof target === 'string' ? target : JSON.stringify(target);
        modelLines.push(`${indent(3)}${field}: '${targetValue}',`);
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

export const generate = async (options: GeneratorOptions) => {
  const { generator, dmmf } = options;

  // Get output path from generator config or default
  const outputPath = generator.output?.value || './generated/tenant-guard';
  const resolvedOutputPath = resolve(outputPath, 'meta.ts');
  const jsonOutputPath = resolve(outputPath, 'meta.json');

  // Get generator config options
  const config = generator.config;
  const tenantFieldCandidates = (config.tenantField as string || 'tenantId')
    .split(',')
    .map((field) => field.trim())
    .filter(Boolean);

  if (tenantFieldCandidates.length === 0) {
    tenantFieldCandidates.push('tenantId');
  }

  const includeSet = typeof config.include === 'string'
    ? new Set(config.include.split(',').map((s: string) => s.trim()))
    : config.include ? new Set(config.include) : undefined;
  const excludeSet = typeof config.exclude === 'string'
    ? new Set(config.exclude.split(',').map((s: string) => s.trim()))
    : config.exclude ? new Set(config.exclude) : undefined;

  try {
    const candidates: CandidateModel[] = [];

    // Process models from the provided DMMF (no need to call getDMMF)
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

      const compositeSelector = detectCompositeSelector(model, tenantField.name);
      const relations: Array<{ fieldName: string; targetModel: string }> = [];

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

    const candidateByName = new Map(candidates.map((candidate) => [candidate.name, candidate]));
    const meta: TenantMeta = {};

    for (const candidate of candidates) {
      const nestedTargets: Record<string, string> = {};

      for (const relation of candidate.relations) {
        if (!candidateByName.has(relation.targetModel)) {
          continue;
        }
        nestedTargets[relation.fieldName] = relation.targetModel;
      }

      meta[candidate.name] = {
        tenantField: candidate.tenantField,
        ...(candidate.compositeSelector ? { compositeSelector: candidate.compositeSelector } : {}),
        ...(Object.keys(nestedTargets).length > 0 ? { nestedTargets } : {}),
      };
    }

    // Write TypeScript file
    const outputDir = dirname(resolvedOutputPath);
    await mkdir(outputDir, { recursive: true });
    const tsContent = formatMeta(meta);
    await writeFile(resolvedOutputPath, tsContent, 'utf8');

    // Write JSON file
    const jsonDir = dirname(jsonOutputPath);
    await mkdir(jsonDir, { recursive: true });
    await writeFile(jsonOutputPath, JSON.stringify(meta, null, 2) + '\n', 'utf8');

    console.log(`✔ Generated tenant guard meta for ${Object.keys(meta).length} models -> ${resolvedOutputPath} (.ts), ${jsonOutputPath} (.json)`);

  } catch (error) {
    console.error('Failed to generate tenant guard meta:', error);
    throw error;
  }
};

generatorHandler({
  onManifest: () => ({
    defaultOutput: '../.prisma/tenant-guard',
    prettyName: 'AuthzKit Tenant Guard Generator',
  }),
  onGenerate: generate,
});