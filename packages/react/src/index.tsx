import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';

import type { PolicyActionMap, PolicyDecision } from '@authzkit/core';

type ActionKey<M extends PolicyActionMap> = Extract<keyof M, string>;

export type DecisionStatus = 'unknown' | 'allowed' | 'denied';

export interface DecisionState<
  M extends PolicyActionMap,
  A extends ActionKey<M> = ActionKey<M>,
> {
  status: DecisionStatus;
  decision?: PolicyDecision<M, A>;
}

type GenericDecisionState = DecisionState<PolicyActionMap, ActionKey<PolicyActionMap>>;

export const DecisionContext = createContext<GenericDecisionState>({ status: 'unknown' });

export interface DecisionProviderProps<
  M extends PolicyActionMap,
  A extends ActionKey<M> = ActionKey<M>,
> {
  value: DecisionState<M, A>;
  children?: ReactNode;
}

/**
 * React context provider that makes policy decisions available to child components.
 * This component should wrap your application or the parts that need access to authorization decisions.
 *
 * @param props - Provider props
 * @param props.value - The decision state to provide to child components
 * @param props.children - Child components that will have access to the decision context
 * @returns A React context provider component
 *
 * @example
 * ```jsx
 * // Provide a policy decision to child components
 * function App() {
 *   const [user, setUser] = useState(null);
 *   const [post, setPost] = useState(null);
 *
 *   // Get decision from your policy
 *   const decision = policy.checkDetailed('post.edit', {
 *     subject: user,
 *     resource: post
 *   });
 *
 *   const decisionState = {
 *     status: decision.allow ? 'allowed' : 'denied',
 *     decision: decision
 *   };
 *
 *   return (
 *     <DecisionProvider value={decisionState}>
 *       <PostEditor />
 *     </DecisionProvider>
 *   );
 * }
 * ```
 */
export const DecisionProvider = <
  M extends PolicyActionMap,
  A extends ActionKey<M> = ActionKey<M>,
>({
  value,
  children,
}: DecisionProviderProps<M, A>) => (
  <DecisionContext.Provider value={value as GenericDecisionState}>
    {children}
  </DecisionContext.Provider>
);

/**
 * React hook that provides access to the current authorization decision from the DecisionProvider.
 * This hook must be used within a component wrapped by DecisionProvider.
 *
 * @returns The current decision state containing status and decision details
 *
 * @example
 * ```jsx
 * // Use the decision hook in a component
 * function PostEditor() {
 *   const decision = useDecision();
 *
 *   if (decision.status === 'unknown') {
 *     return <div>Loading permissions...</div>;
 *   }
 *
 *   if (decision.status === 'denied') {
 *     return <div>You don't have permission to edit this post.</div>;
 *   }
 *
 *   return (
 *     <form>
 *       <input type="text" placeholder="Post title" />
 *       <textarea placeholder="Post content" />
 *       <button type="submit">Save Post</button>
 *     </form>
 *   );
 * }
 * ```
 */
export const useDecision = <
  M extends PolicyActionMap,
  A extends ActionKey<M> = ActionKey<M>,
>() => useContext(DecisionContext) as DecisionState<M, A>;

export type GuardRenderer<M extends PolicyActionMap, A extends ActionKey<M>> =
  | ReactNode
  | ((state: DecisionState<M, A>) => ReactNode);

const renderNode = <M extends PolicyActionMap, A extends ActionKey<M>>(
  renderer: GuardRenderer<M, A> | undefined,
  state: DecisionState<M, A>,
): ReactNode => {
  if (!renderer) {
    return null;
  }

  return typeof renderer === 'function'
    ? (renderer as (value: DecisionState<M, A>) => ReactNode)(state)
    : renderer;
};

export interface GuardProps<
  M extends PolicyActionMap,
  A extends ActionKey<M> = ActionKey<M>,
> {
  state?: DecisionState<M, A>;
  pending?: GuardRenderer<M, A>;
  denied?: GuardRenderer<M, A>;
  fallback?: GuardRenderer<M, A>;
  children?: GuardRenderer<M, A>;
}

/**
 * React component that conditionally renders content based on authorization decisions.
 * This component provides a declarative way to show/hide UI elements based on permissions.
 *
 * @param props - Guard component props
 * @param props.state - Optional inline decision state (overrides context)
 * @param props.pending - Content to show when decision status is 'unknown'
 * @param props.denied - Content to show when decision status is 'denied'
 * @param props.fallback - Default content to show for both pending and denied states
 * @param props.children - Content to show when decision status is 'allowed'
 * @returns React component that renders appropriate content based on authorization state
 *
 * @example
 * ```jsx
 * // Basic usage with DecisionProvider context
 * function PostActions() {
 *   return (
 *     <Guard
 *       pending={<div>Checking permissions...</div>}
 *       denied={<div>Access denied</div>}
 *     >
 *       <button>Edit Post</button>
 *       <button>Delete Post</button>
 *     </Guard>
 *   );
 * }
 *
 * // Usage with inline decision state
 * function AdvancedGuard() {
 *   const editDecision = policy.checkDetailed('post.edit', { subject: user, resource: post });
 *
 *   return (
 *     <Guard
 *       state={{
 *         status: editDecision.allow ? 'allowed' : 'denied',
 *         decision: editDecision
 *       }}
 *       denied="You cannot edit this post"
 *     >
 *       <PostEditForm />
 *     </Guard>
 *   );
 * }
 * ```
 */
export const Guard = <M extends PolicyActionMap, A extends ActionKey<M> = ActionKey<M>>({
  state: inlineState,
  pending,
  denied,
  fallback,
  children,
}: GuardProps<M, A>) => {
  const contextState = useContext(DecisionContext) as DecisionState<M, A>;
  const state = inlineState ?? contextState;

  if (state.status === 'unknown') {
    return renderNode(pending ?? fallback, state);
  }

  if (state.status === 'denied') {
    return renderNode(denied ?? fallback, state);
  }

  return renderNode(children, state);
};
