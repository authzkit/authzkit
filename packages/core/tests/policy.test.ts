import { describe, expect, it, expectTypeOf } from 'vitest';

import { action, defineActions, definePolicy } from '../src/index.js';
import type {
  ActionReadMask,
  ActionWriteMask,
  PolicyDecisionFactory,
  RuleMatchDetails,
} from '../src/index.js';

type Subject = {
  id: string;
  role: 'admin' | 'editor' | 'viewer';
  tenantId: string;
};

type Post = {
  id: string;
  authorId: string;
  tenantId: string;
};

type UpdatePostInput = {
  title?: string;
  body?: string;
  tags?: string[];
};

type CreatePostInput = {
  title: string;
  body: string;
  tenantId: string;
};

type PolicyShape = {
  'post.read': {
    subject: Subject;
    resource: Post;
  };
  'post.update': {
    subject: Subject;
    resource: Post;
    data: UpdatePostInput;
  };
};

describe('definePolicy', () => {
  const policy = definePolicy<PolicyShape>({
    rules: [
      {
        id: 'admins-can-do-anything',
        action: ['post.read', 'post.update'],
        effect: 'allow',
        when: ({ subject }) => subject.role === 'admin',
      },
      {
        id: 'owner-can-update',
        action: 'post.update',
        effect: 'allow',
        when: ({ subject, resource }) => subject.id === resource.authorId,
      },
      {
        id: 'cross-tenant-deny',
        action: ['post.read', 'post.update'],
        effect: 'deny',
        when: ({ subject, resource }) => subject.tenantId !== resource.tenantId,
        reason: 'TENANT_MISMATCH',
      },
    ],
  });

  const baseReadInput = {
    subject: { id: 'user-1', role: 'viewer', tenantId: 'tenant-a' } as Subject,
    resource: { id: 'post-1', tenantId: 'tenant-a', authorId: 'user-2' } as Post,
  };

  it('returns allow when a rule matches', () => {
    const decision = policy.checkDetailed('post.read', {
      ...baseReadInput,
      subject: { ...baseReadInput.subject, role: 'admin' },
    });

    expect(decision.allow).toBe(true);
    expect(decision.matchedRule).toBe('admins-can-do-anything');
  });

  it('falls back to default deny when no rule matches', () => {
    const decision = policy.checkDetailed('post.read', baseReadInput);

    expect(decision.allow).toBe(false);
    expect(decision.reason).toBe('DEFAULT_DENY');
    expect(decision.matchedRule).toBeUndefined();
    expect(decision.effect).toBe('default');
  });

  it('resolves rule-level deny before allow rules', () => {
    const decision = policy.checkDetailed('post.update', {
      subject: { id: 'user-3', role: 'editor', tenantId: 'tenant-b' },
      resource: { id: 'post-9', authorId: 'user-3', tenantId: 'tenant-a' },
      data: { title: 'Draft title' },
    });

    expect(decision.allow).toBe(false);
    expect(decision.matchedRule).toBe('cross-tenant-deny');
    expect(decision.reason).toBe('TENANT_MISMATCH');
  });

  it('allows owner updates when tenant matches', () => {
    const decision = policy.checkDetailed('post.update', {
      subject: { id: 'user-2', role: 'editor', tenantId: 'tenant-a' },
      resource: { id: 'post-1', authorId: 'user-2', tenantId: 'tenant-a' },
      data: { title: 'Draft title' },
    });

    expect(decision.allow).toBe(true);
    expect(decision.matchedRule).toBe('owner-can-update');
  });

  it('supports match details from predicates', () => {
    const policyWithDetails = definePolicy<PolicyShape>({
      rules: [
        {
          id: 'explainable-allow',
          action: 'post.read',
          effect: 'allow',
          when: ({ subject, resource }): RuleMatchDetails<PolicyShape, 'post.read'> => ({
            matches: subject.tenantId === resource.tenantId,
            reason: 'MATCHING_TENANT',
            attrs: { tenant: subject.tenantId },
          }),
        },
      ],
    });

    const decision = policyWithDetails.checkDetailed('post.read', baseReadInput);

    expect(decision.allow).toBe(true);
    expect(decision.reason).toBe('MATCHING_TENANT');
    expect(decision.attrs).toEqual({ tenant: 'tenant-a' });
  });

  it('exposes a describe helper for introspection', () => {
    expect(policy.describe().map((rule) => rule.id)).toEqual([
      'admins-can-do-anything',
      'owner-can-update',
      'cross-tenant-deny',
    ]);
  });

  it('infers action-specific input types', () => {
    const decision = policy.check('post.update', {
      subject: { id: 'user-2', role: 'editor', tenantId: 'tenant-a' },
      resource: { id: 'post-1', authorId: 'user-2', tenantId: 'tenant-a' },
      data: { title: 'Draft title' },
    });

    expectTypeOf(decision).toEqualTypeOf<boolean>();

    type UpdateFactory = PolicyDecisionFactory<PolicyShape, 'post.update'>;
    expectTypeOf<UpdateFactory>().toEqualTypeOf<
      PolicyDecisionFactory<PolicyShape, 'post.update'>
    >();
  });
});

describe('field masks', () => {
  const maskActions = defineActions({
    'post.update': action<{
      subject: Subject;
      resource: Post;
      data: UpdatePostInput;
    }>(),
  });

  type MaskPolicy = typeof maskActions;

  const maskPolicy = definePolicy<MaskPolicy>({
    rules: [
      {
        id: 'deny-cross-tenant',
        action: 'post.update',
        effect: 'deny',
        when: ({ subject, resource }) => subject.tenantId !== resource.tenantId,
        reason: 'TENANT_MISMATCH',
      },
      {
        id: 'editor-base',
        action: 'post.update',
        effect: 'allow',
        when: ({ subject }) => subject.role === 'editor',
        readMask: { id: true, authorId: true },
        writeMask: { title: true },
      },
      {
        id: 'owner-bonus',
        action: 'post.update',
        effect: 'allow',
        when: ({ subject, resource }): RuleMatchDetails<MaskPolicy, 'post.update'> => ({
          matches: subject.id === resource.authorId,
          readMask: { tenantId: true },
          writeMask: { body: true },
        }),
      },
    ],
  });
  void maskActions;

  it('merges read and write masks across allow rules', () => {
    const decision = maskPolicy.checkDetailed('post.update', {
      subject: { id: 'user-2', role: 'editor', tenantId: 'tenant-a' },
      resource: { id: 'post-1', authorId: 'user-2', tenantId: 'tenant-a' },
      data: { title: 'Draft title', body: 'Draft body' },
    });

    expect(decision.allow).toBe(true);
    expect(decision.readMask).toEqual({ id: true, authorId: true, tenantId: true });
    expect(decision.writeMask).toEqual({ title: true, body: true });

    expectTypeOf(decision.readMask).toEqualTypeOf<
      ActionReadMask<MaskPolicy, 'post.update'> | undefined
    >();
    expectTypeOf(decision.writeMask).toEqualTypeOf<
      ActionWriteMask<MaskPolicy, 'post.update'> | undefined
    >();
  });

  it('short-circuits masks when a deny rule matches first', () => {
    const decision = maskPolicy.checkDetailed('post.update', {
      subject: { id: 'user-2', role: 'editor', tenantId: 'tenant-a' },
      resource: { id: 'post-1', authorId: 'user-2', tenantId: 'tenant-b' },
      data: { title: 'Draft title', body: 'Draft body' },
    });

    expect(decision.allow).toBe(false);
    expect(decision.readMask).toBeUndefined();
    expect(decision.writeMask).toBeUndefined();
    expect(decision.reason).toBe('TENANT_MISMATCH');
  });
});

describe('defineActions helper', () => {
  const actions = defineActions({
    'post.create': action<{
      subject: Subject;
      data: CreatePostInput;
    }>(),
    'post.delete': action<{
      subject: Subject;
      resource: Post;
    }>(),
  });
  void actions;

  type ActionMap = typeof actions;

  it('produces a typed action map', () => {
    expectTypeOf<ActionMap['post.create']>().toEqualTypeOf<{
      subject: Subject;
      data: CreatePostInput;
    }>();

    expectTypeOf<ActionMap['post.delete']>().toEqualTypeOf<{
      subject: Subject;
      resource: Post;
    }>();
  });

  it('allows defining policies using helper output', () => {
    const policy = definePolicy<ActionMap>({
      rules: [
        {
          id: 'editor-can-create',
          action: 'post.create',
          effect: 'allow',
          when: ({ subject }) => subject.role !== 'viewer',
        },
      ],
    });

    const decision = policy.checkDetailed('post.create', {
      subject: { id: 'user-1', role: 'editor', tenantId: 'tenant-a' },
      data: { title: 'Post', body: 'Body', tenantId: 'tenant-a' },
    });

    expect(decision.allow).toBe(true);
  });
});
