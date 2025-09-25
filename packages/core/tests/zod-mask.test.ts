import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import type { FieldMask } from '../src';
import { maskReadSchema, maskRefinement, maskWriteSchema } from '../src/zod';

describe('maskWriteSchema', () => {
  const UpdateSchema = z.object({
    title: z.string().min(3),
    body: z.string().min(10),
    meta: z.object({
      tags: z.array(z.object({ label: z.string(), value: z.string() })),
      stats: z.object({
        views: z.number().int().nonnegative(),
        likes: z.number().int().nonnegative(),
      }),
    }),
  });

  type UpdateInput = z.infer<typeof UpdateSchema>;

  const writeMask: FieldMask<UpdateInput> = {
    title: true,
    meta: {
      tags: {
        label: true,
      },
    },
  };

  const schema = maskWriteSchema(UpdateSchema, writeMask);

  it('allows masked fields and treats them as optional', () => {
    expect(schema.safeParse({}).success).toBe(true);
    expect(
      schema.safeParse({
        title: 'Draft title',
        meta: { tags: [{ label: 'draft' }] },
      }).success,
    ).toBe(true);
  });

  it('rejects fields outside the mask', () => {
    expect(
      schema.safeParse({
        body: 'This should fail due to mask',
      }).success,
    ).toBe(false);

    expect(
      schema.safeParse({
        meta: { tags: [{ label: 'draft', value: 'hidden' }] },
      }).success,
    ).toBe(false);
  });
});

describe('maskReadSchema', () => {
  const PostSchema = z.object({
    id: z.string(),
    title: z.string(),
    body: z.string(),
    meta: z.object({
      stats: z.object({
        views: z.number(),
        likes: z.number(),
      }),
      tags: z.array(z.string()),
    }),
  });

  type Post = z.infer<typeof PostSchema>;

  const readMask: FieldMask<Post> = {
    id: true,
    meta: {
      stats: {
        views: true,
      },
    },
  };

  const schema = maskReadSchema(PostSchema, readMask);

  it('strips fields not present in the mask', () => {
    const result = schema.parse({
      id: 'post-1',
      title: 'Hidden',
      meta: {
        stats: { views: 42, likes: 10 },
        tags: ['a', 'b'],
      },
    });

    expect(result).toEqual({
      id: 'post-1',
      meta: {
        stats: { views: 42 },
      },
    });
  });
});

describe('maskRefinement', () => {
  const BaseSchema = z
    .object({
      title: z.string().optional(),
      flags: z
        .object({
          featured: z.boolean().optional(),
        })
        .passthrough()
        .optional(),
    })
    .passthrough();

  type BaseInput = z.infer<typeof BaseSchema>;

  const writeMask: FieldMask<BaseInput> = {
    title: true,
    flags: {
      featured: true,
    },
  };

  const schema = BaseSchema.superRefine(maskRefinement(writeMask));

  it('fails when the payload contains masked-out fields', () => {
    const outcome = schema.safeParse({
      title: 'ok',
      flags: { featured: true, hidden: true },
    });
    expect(outcome.success).toBe(false);
  });

  it('succeeds with payloads that respect the mask', () => {
    const outcome = schema.safeParse({ flags: { featured: false } });
    expect(outcome.success).toBe(true);
  });
});
