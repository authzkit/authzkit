import {
  z,
  ZodArray,
  ZodCatch,
  ZodDefault,
  ZodEffects,
  ZodNullable,
  ZodObject,
  ZodOptional,
  type RefinementCtx,
  type ZodRawShape,
  type ZodType,
  type ZodTypeAny,
  type ZodTypeDef,
} from 'zod';

import type { FieldMask } from './index.js';

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export type MaskMode = 'read' | 'write';

export interface MaskSchemaOptions<Mode extends MaskMode = 'read'> {
  mode?: Mode;
  strict?: boolean;
}

type MaskNode<Value, Mask, Mode extends MaskMode> = Mask extends undefined | true
  ? Value
  : Value extends ReadonlyArray<infer Item>
    ? Value extends Array<Item>
      ? MaskNode<Item, NonNullable<Mask>, Mode>[]
      : ReadonlyArray<MaskNode<Item, NonNullable<Mask>, Mode>>
    : Mask extends Record<string, unknown>
      ? Value extends Record<string, unknown>
        ? Mode extends 'write'
          ? { [K in keyof Value & keyof Mask]?: MaskNode<Value[K], Mask[K], Mode> }
          : { [K in keyof Value & keyof Mask]: MaskNode<Value[K], Mask[K], Mode> }
        : Value
      : Value;

export type MaskedInput<
  Schema extends ZodTypeAny,
  Mask,
  Mode extends MaskMode = 'read',
> = MaskNode<z.input<Schema>, Mask, Mode>;

export type MaskedOutput<
  Schema extends ZodTypeAny,
  Mask,
  Mode extends MaskMode = 'read',
> = MaskNode<z.output<Schema>, Mask, Mode>;

export type MaskedSchema<
  Schema extends ZodTypeAny,
  Mask,
  Mode extends MaskMode = 'read',
> = ZodType<
  MaskedOutput<Schema, Mask, Mode>,
  ZodTypeDef,
  MaskedInput<Schema, Mask, Mode>
>;

export function maskSchema<
  Schema extends ZodTypeAny,
  Mask extends FieldMask<z.output<Schema>> | true | undefined,
  Mode extends MaskMode = 'read',
>(
  schema: Schema,
  mask: Mask,
  options?: MaskSchemaOptions<Mode>,
): MaskedSchema<Schema, Mask, Mode> {
  const mode = options?.mode ?? 'read';
  const strict = options?.strict ?? mode === 'write';

  if (mask === undefined || mask === true) {
    return schema as MaskedSchema<Schema, Mask, Mode>;
  }

  const masked = applyMask(schema, mask, mode, strict);
  return masked as MaskedSchema<Schema, Mask, Mode>;
}

export const maskReadSchema = <
  Schema extends ZodTypeAny,
  Mask extends FieldMask<z.output<Schema>> | true | undefined,
>(
  schema: Schema,
  mask: Mask,
  options?: Omit<MaskSchemaOptions<'read'>, 'mode'>,
): MaskedSchema<Schema, Mask, 'read'> =>
  maskSchema(schema, mask, { ...options, mode: 'read' });

export const maskWriteSchema = <
  Schema extends ZodTypeAny,
  Mask extends FieldMask<z.output<Schema>> | true | undefined,
>(
  schema: Schema,
  mask: Mask,
  options?: Omit<MaskSchemaOptions<'write'>, 'mode'>,
): MaskedSchema<Schema, Mask, 'write'> =>
  maskSchema(schema, mask, { ...options, mode: 'write' });

export interface MaskRefinementOptions {
  message?: string;
}

export const maskRefinement = <Value>(
  mask: FieldMask<Value> | true | undefined,
  options?: MaskRefinementOptions,
) => {
  const message = options?.message ?? 'Field is not permitted by the current policy mask';

  if (mask === undefined || mask === true) {
    return () => undefined;
  }

  return (value: unknown, ctx: RefinementCtx) => {
    validateAgainstMask(value, mask, ctx, [], message);
  };
};

const applyMask = (
  schema: ZodTypeAny,
  mask: unknown,
  mode: MaskMode,
  strict: boolean,
): ZodTypeAny => {
  if (mask === undefined || mask === true) {
    return schema;
  }

  if (schema instanceof ZodOptional) {
    return applyMask(schema.unwrap(), mask, mode, strict).optional();
  }

  if (schema instanceof ZodNullable) {
    return applyMask(schema.unwrap(), mask, mode, strict).nullable();
  }

  if (schema instanceof ZodDefault) {
    const inner = applyMask(schema.removeDefault(), mask, mode, strict);
    return inner.default(schema._def.defaultValue);
  }

  if (schema instanceof ZodCatch) {
    const inner = applyMask(schema.removeCatch(), mask, mode, strict);
    return inner.catch(schema._def.catchValue);
  }

  if (schema instanceof ZodEffects) {
    const inner = applyMask(schema.innerType(), mask, mode, strict);
    const effect = schema._def.effect;

    if (effect.type === 'preprocess') {
      return ZodEffects.createWithPreprocess(effect.transform, inner);
    }

    return ZodEffects.create(inner, effect);
  }

  if (schema instanceof ZodArray) {
    return applyMaskToArray(schema, mask, mode, strict);
  }

  if (schema instanceof ZodObject) {
    return applyMaskToObject(schema, mask, mode, strict);
  }

  return schema;
};

const applyMaskToArray = (
  schema: ZodArray<ZodTypeAny>,
  mask: unknown,
  mode: MaskMode,
  strict: boolean,
): ZodTypeAny => {
  if (mask === true || mask === undefined) {
    return schema;
  }

  const elementMask = isPlainObject(mask) ? mask : undefined;
  const maskedElement = elementMask
    ? applyMask(schema.element, elementMask, mode, strict)
    : schema.element;

  const def = schema._def;
  const next = new ZodArray({
    ...def,
    type: maskedElement,
  });

  return next;
};

const applyMaskToObject = (
  schema: ZodObject<ZodRawShape>,
  mask: unknown,
  mode: MaskMode,
  strict: boolean,
): ZodTypeAny => {
  if (!isPlainObject(mask)) {
    return schema;
  }

  const maskRecord = mask;
  const keys = Object.keys(maskRecord);

  if (keys.length === 0) {
    if (mode === 'write') {
      const base = z.object({}).partial();
      return strict ? base.strict() : base;
    }

    const base = z.object({});
    return strict ? base.strict() : base;
  }

  const pickShape = keys.reduce<Record<string, true>>((acc, key) => {
    acc[key] = true;
    return acc;
  }, {});

  let masked = schema.pick(pickShape);
  const updates: ZodRawShape = {};

  for (const key of keys) {
    const field = schema.shape[key];
    if (!field) {
      throw new Error(`Mask references unknown field \"${key}\"`);
    }
    updates[key] = applyMask(field, maskRecord[key], mode, strict);
  }

  masked = masked.extend(updates);

  if (mode === 'write') {
    masked = masked.partial();
  }

  if (strict) {
    masked = masked.strict();
  }

  return masked;
};

const validateAgainstMask = (
  value: unknown,
  mask: unknown,
  ctx: z.RefinementCtx,
  path: (string | number)[],
  message: string,
): void => {
  if (mask === undefined || mask === true) {
    return;
  }

  if (Array.isArray(value)) {
    if (!isPlainObject(mask)) {
      return;
    }

    value.forEach((item, index) => {
      validateAgainstMask(item, mask, ctx, [...path, index], message);
    });
    return;
  }

  if (!isPlainObject(value)) {
    return;
  }

  if (!isPlainObject(mask)) {
    return;
  }

  const record = value;
  const maskRecord = mask;

  for (const [key, child] of Object.entries(record)) {
    const entryMask = maskRecord[key];
    if (!entryMask) {
      ctx.addIssue({
        code: 'custom',
        path: [...path, key],
        message,
      });
      continue;
    }

    validateAgainstMask(child, entryMask, ctx, [...path, key], message);
  }
};
