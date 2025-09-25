export type PolicyActionMap = Record<string, unknown>;

type Primitive = string | number | boolean | null | undefined | symbol | bigint;

export type FieldMask<T> = {
  [K in keyof T]?: T[K] extends Primitive | Date
    ? true
    : T[K] extends Array<infer U>
      ? true | FieldMask<U>
      : true | FieldMask<T[K]>;
};

export type ActionDefinition<TInput> = {
  readonly __input?: TInput;
};

/**
 * Creates a type-safe action definition for use in policy action maps.
 * This is a TypeScript utility that helps define the input type for policy actions.
 *
 * @template TInput - The input type expected when this action is evaluated
 * @returns An action definition that can be used in defineActions()
 *
 * @example
 * ```javascript
 * // For JavaScript users - you can skip the type parameter
 * const readAction = action();
 *
 * // For TypeScript users - specify the input type
 * const readAction = action<{ userId: string; resourceId: string }>();
 * ```
 */
export const action = <TInput>(): ActionDefinition<TInput> =>
  ({}) as ActionDefinition<TInput>;

/**
 * Defines a collection of policy actions with their input types.
 * This creates a type-safe action map that can be used with definePolicy().
 *
 * @param definitions - An object mapping action names to action definitions
 * @returns A type-safe action map for use in policies
 *
 * @example
 * ```javascript
 * // Define actions for a blog application
 * const actions = defineActions({
 *   'post.read': action(),
 *   'post.edit': action(),
 *   'post.delete': action(),
 *   'comment.create': action(),
 * });
 *
 * // Now you can use these actions in your policy rules
 * ```
 */
export const defineActions = <
  Definitions extends Record<string, ActionDefinition<unknown>>,
>(
  definitions: Definitions,
) =>
  definitions as unknown as {
    [K in keyof Definitions]: NonNullable<Definitions[K]['__input']>;
  };

type MaskRecord = Record<string, unknown>;

const isMaskRecord = (value: unknown): value is MaskRecord =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const cloneMask = (mask: MaskRecord): MaskRecord => {
  const result: MaskRecord = {};
  for (const [key, value] of Object.entries(mask)) {
    if (value === true) {
      result[key] = true;
      continue;
    }

    if (isMaskRecord(value)) {
      result[key] = cloneMask(value);
      continue;
    }

    result[key] = true;
  }
  return result;
};

const mergeMaskRecords = (
  base: MaskRecord | undefined,
  next: MaskRecord | undefined,
): MaskRecord | undefined => {
  if (!next) {
    return base ? cloneMask(base) : undefined;
  }

  if (!base) {
    return cloneMask(next);
  }

  const result = cloneMask(base);

  for (const [key, value] of Object.entries(next)) {
    if (value === true) {
      result[key] = true;
      continue;
    }

    if (!isMaskRecord(value)) {
      result[key] = true;
      continue;
    }

    const existing = result[key];

    if (existing === true) {
      continue;
    }

    if (isMaskRecord(existing)) {
      result[key] = mergeMaskRecords(existing, value) ?? cloneMask(value);
      continue;
    }

    result[key] = cloneMask(value);
  }

  return result;
};

const mergeMasks = <T extends MaskRecord>(
  base: T | undefined,
  next: T | undefined,
): T | undefined => {
  const merged = mergeMaskRecords(base, next);
  return merged as T | undefined;
};

const mergeActionMasks = <T>(base: T | undefined, next: T | undefined): T | undefined =>
  mergeMasks(base as MaskRecord | undefined, next as MaskRecord | undefined) as
    | T
    | undefined;

const resolveMaskFactory = <M extends PolicyActionMap, A extends PolicyActionKey<M>, T>(
  factory: MaskFactoryValue<M, A, T> | undefined,
  input: PolicyInput<M, A>,
): T | undefined => {
  if (!factory) {
    return undefined;
  }

  if (typeof factory === 'function') {
    const fn = factory as (value: PolicyInput<M, A>) => T | undefined;
    return fn(input);
  }

  return factory as T;
};

type PolicyActionKey<M extends PolicyActionMap> = Extract<keyof M, string>;

export type ActionInput<M extends PolicyActionMap, A extends PolicyActionKey<M>> = M[A];

export type ActionSubject<M extends PolicyActionMap, A extends PolicyActionKey<M>> =
  ActionInput<M, A> extends { subject: infer S } ? S : never;

export type ActionResource<M extends PolicyActionMap, A extends PolicyActionKey<M>> =
  ActionInput<M, A> extends { resource: infer R } ? R : never;

export type ActionData<M extends PolicyActionMap, A extends PolicyActionKey<M>> =
  ActionInput<M, A> extends { data: infer D } ? D : never;

export type ActionReadMask<M extends PolicyActionMap, A extends PolicyActionKey<M>> =
  ActionResource<M, A> extends never ? never : FieldMask<ActionResource<M, A>>;

export type ActionWriteMask<M extends PolicyActionMap, A extends PolicyActionKey<M>> =
  ActionData<M, A> extends never ? never : FieldMask<ActionData<M, A>>;

export type PolicyEffect = 'allow' | 'deny';

export interface RuleMatchDetails<
  M extends PolicyActionMap,
  A extends PolicyActionKey<M>,
> {
  matches: boolean;
  reason?: string;
  attrs?: Record<string, unknown>;
  readMask?: ActionReadMask<M, A>;
  writeMask?: ActionWriteMask<M, A>;
}

export type RuleEvaluator<M extends PolicyActionMap, A extends PolicyActionKey<M>> = (
  input: PolicyInput<M, A>,
) => boolean | RuleMatchDetails<M, A>;

type MaskFactoryValue<M extends PolicyActionMap, A extends PolicyActionKey<M>, T> = [
  T,
] extends [never]
  ? undefined
  : T | ((input: PolicyInput<M, A>) => T | undefined);

export interface PolicyRule<
  M extends PolicyActionMap,
  A extends PolicyActionKey<M> = PolicyActionKey<M>,
> {
  id: string;
  action: A | readonly A[];
  effect: PolicyEffect;
  when?: RuleEvaluator<M, A>;
  reason?: string;
  meta?: Record<string, unknown>;
  readMask?: MaskFactoryValue<M, A, ActionReadMask<M, A>>;
  writeMask?: MaskFactoryValue<M, A, ActionWriteMask<M, A>>;
}

export interface PolicyDecision<
  M extends PolicyActionMap,
  A extends PolicyActionKey<M> = PolicyActionKey<M>,
> {
  allow: boolean;
  reason?: string;
  matchedRule?: string;
  effect: PolicyEffect | 'default';
  attrs?: Record<string, unknown>;
  context: {
    action: A;
  };
  readMask?: ActionReadMask<M, A>;
  writeMask?: ActionWriteMask<M, A>;
}

export interface PolicyEvaluationContext<
  M extends PolicyActionMap,
  A extends PolicyActionKey<M> = PolicyActionKey<M>,
> {
  action: A;
  input: PolicyInput<M, A>;
}

export type PolicyDecisionFactory<
  M extends PolicyActionMap,
  A extends PolicyActionKey<M> = PolicyActionKey<M>,
> =
  | PolicyDecision<M, A>
  | ((context: PolicyEvaluationContext<M, A>) => PolicyDecision<M, A>);

export interface PolicyConfig<M extends PolicyActionMap> {
  rules: ReadonlyArray<PolicyRule<M>>;
  defaultDecision?: PolicyDecisionFactory<M>;
}

export type PolicyInput<
  M extends PolicyActionMap,
  A extends PolicyActionKey<M>,
> = ActionInput<M, A>;

export interface Policy<M extends PolicyActionMap> {
  check<A extends PolicyActionKey<M>>(action: A, input: PolicyInput<M, A>): boolean;
  checkDetailed<A extends PolicyActionKey<M>>(
    action: A,
    input: PolicyInput<M, A>,
  ): PolicyDecision<M, A>;
  describe(): PolicyRule<M>[];
}

const DEFAULT_REASON = 'DEFAULT_DENY';

const toArray = <T>(value: T | readonly T[]): readonly T[] =>
  (Array.isArray(value) ? value : [value]) as readonly T[];

const normaliseDecision = <M extends PolicyActionMap, A extends PolicyActionKey<M>>(
  factory: PolicyDecisionFactory<M, A>,
  context: PolicyEvaluationContext<M, A>,
): PolicyDecision<M, A> => {
  const base = typeof factory === 'function' ? factory(context) : factory;

  return {
    ...base,
    effect: base.effect ?? 'default',
    context: base.context ?? { action: context.action },
  };
};

/**
 * Creates a new policy engine with the specified configuration.
 * This is the main entry point for creating authorization policies in AuthzKit.
 *
 * @param config - Policy configuration containing rules and optional default decision
 * @param config.rules - Array of policy rules that define authorization logic
 * @param config.defaultDecision - Optional default decision when no rules match (defaults to deny)
 * @returns A policy object with check(), checkDetailed(), and describe() methods
 *
 * @example
 * ```javascript
 * // Create a simple policy for a blog application
 * const policy = definePolicy({
 *   rules: [
 *     {
 *       action: 'post.read',
 *       effect: 'allow',
 *       when: ({ subject, resource }) => {
 *         // Allow if post is public or user is the author
 *         return resource.public || subject.id === resource.authorId;
 *       }
 *     },
 *     {
 *       action: 'post.edit',
 *       effect: 'allow',
 *       when: ({ subject, resource }) => {
 *         // Only allow author or admin to edit
 *         return subject.id === resource.authorId || subject.role === 'admin';
 *       }
 *     }
 *   ]
 * });
 *
 * // Use the policy to check permissions
 * const canRead = policy.check('post.read', {
 *   subject: { id: 'user1', role: 'member' },
 *   resource: { id: 'post1', authorId: 'user2', public: true }
 * });
 * ```
 */
export const definePolicy = <M extends PolicyActionMap>(
  config: PolicyConfig<M>,
): Policy<M> => {
  const rules = [...config.rules];
  const defaultDecision: PolicyDecisionFactory<M> =
    config.defaultDecision ??
    ((ctx) => ({
      allow: false,
      reason: DEFAULT_REASON,
      effect: 'default',
      context: { action: ctx.action },
    }));

  const evaluateRule = <A extends PolicyActionKey<M>>(
    rule: PolicyRule<M>,
    action: A,
    input: PolicyInput<M, A>,
  ): PolicyDecision<M, A> | undefined => {
    const actions = toArray(rule.action);
    if (!actions.includes(action)) {
      return undefined;
    }

    const evaluator = rule.when as RuleEvaluator<M, A> | undefined;

    if (!evaluator) {
      return buildDecision(rule, action, input, undefined);
    }

    const outcome = evaluator(input);
    if (typeof outcome === 'boolean') {
      return outcome ? buildDecision(rule, action, input, undefined) : undefined;
    }

    if (!outcome.matches) {
      return undefined;
    }

    return buildDecision(rule, action, input, outcome);
  };

  const buildDecision = <A extends PolicyActionKey<M>>(
    rule: PolicyRule<M>,
    action: A,
    input: PolicyInput<M, A>,
    details?: RuleMatchDetails<M, A>,
  ): PolicyDecision<M, A> => {
    const ruleReadMask = resolveMaskFactory(rule.readMask, input);
    const ruleWriteMask = resolveMaskFactory(rule.writeMask, input);
    const combinedReadMask = mergeActionMasks(details?.readMask, ruleReadMask);
    const combinedWriteMask = mergeActionMasks(details?.writeMask, ruleWriteMask);

    const decision: PolicyDecision<M, A> = {
      allow: rule.effect === 'allow',
      matchedRule: rule.id,
      effect: rule.effect,
      context: { action },
    };

    const reason = details?.reason ?? rule.reason;
    if (reason) {
      decision.reason = reason;
    }

    if (details?.attrs) {
      decision.attrs = details.attrs;
    }

    if (combinedReadMask) {
      decision.readMask = combinedReadMask;
    }

    if (combinedWriteMask) {
      decision.writeMask = combinedWriteMask;
    }

    return decision;
  };

  const checkDetailed = <A extends PolicyActionKey<M>>(
    action: A,
    input: PolicyInput<M, A>,
  ): PolicyDecision<M, A> => {
    let firstAllow: PolicyDecision<M, A> | undefined;
    let aggregatedReadMask: ActionReadMask<M, A> | undefined;
    let aggregatedWriteMask: ActionWriteMask<M, A> | undefined;

    for (const rule of rules) {
      const decision = evaluateRule(rule, action, input);
      if (decision) {
        if (!decision.allow) {
          return decision;
        }

        aggregatedReadMask = mergeActionMasks(aggregatedReadMask, decision.readMask);
        aggregatedWriteMask = mergeActionMasks(aggregatedWriteMask, decision.writeMask);

        if (!firstAllow) {
          firstAllow = decision;
        }
      }
    }

    if (firstAllow) {
      if (!aggregatedReadMask && !aggregatedWriteMask) {
        return firstAllow;
      }

      return {
        ...firstAllow,
        ...(aggregatedReadMask ? { readMask: aggregatedReadMask } : {}),
        ...(aggregatedWriteMask ? { writeMask: aggregatedWriteMask } : {}),
      };
    }

    return normaliseDecision(defaultDecision as PolicyDecisionFactory<M, A>, {
      action,
      input,
    });
  };

  const check = <A extends PolicyActionKey<M>>(
    action: A,
    input: PolicyInput<M, A>,
  ): boolean => checkDetailed(action, input).allow;

  const describe = (): PolicyRule<M>[] => [...rules];

  return {
    check,
    checkDetailed,
    describe,
  };
};
