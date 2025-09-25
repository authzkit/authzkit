import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { PolicyDecision } from '@authzkit/core';

import { DecisionProvider, Guard, useDecision } from '../src/index.js';
import type { DecisionState } from '../src/index.js';

afterEach(() => {
  cleanup();
});

type TestActions = {
  'post.read': {
    subject: { id: string };
  };
};

type TestDecision = PolicyDecision<TestActions, 'post.read'>;

type TestState = DecisionState<TestActions, 'post.read'>;

const allowedDecision: TestDecision = {
  allow: true,
  effect: 'allow',
  context: { action: 'post.read' },
  matchedRule: 'allow-all',
};

const deniedDecision: TestDecision = {
  allow: false,
  effect: 'deny',
  context: { action: 'post.read' },
  matchedRule: 'deny-all',
  reason: 'DENIED',
};

describe('Guard', () => {
  it('renders fallback by default while decision is unknown', () => {
    render(<Guard fallback={<span>pending</span>} />);

    expect(screen.getByText('pending')).toBeDefined();
  });

  it('renders allowed content when decision permits', () => {
    const state: TestState = {
      status: 'allowed',
      decision: allowedDecision,
    };

    render(
      <DecisionProvider value={state}>
        <Guard>{({ decision }) => <span>{decision?.matchedRule}</span>}</Guard>
      </DecisionProvider>,
    );

    expect(screen.getByText('allow-all')).toBeDefined();
  });

  it('renders denied content when decision blocks access', () => {
    const state: TestState = {
      status: 'denied',
      decision: deniedDecision,
    };

    render(
      <DecisionProvider value={state}>
        <Guard
          denied={({ decision }) => <span>{decision?.reason}</span>}
          fallback="loading"
        >
          allowed
        </Guard>
      </DecisionProvider>,
    );

    expect(screen.getByText('DENIED')).toBeDefined();
  });
});

describe('useDecision', () => {
  it('exposes the current decision state from context', () => {
    const observed: TestState[] = [];

    const Probe = () => {
      const state = useDecision<TestActions, 'post.read'>();
      observed.push(state);
      return null;
    };

    const state: TestState = {
      status: 'allowed',
      decision: allowedDecision,
    };

    render(
      <DecisionProvider value={state}>
        <Probe />
      </DecisionProvider>,
    );

    expect(observed[0]).toEqual(state);
  });
});
