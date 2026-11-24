// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { Observatorio } from './Observatorio';

afterEach(cleanup);

const empty = { sessions: [], totalOutput: 0, totalSamples: 0, totalCost: 0, series: [] };
const props = { connected: true, onUsageList: () => {}, sessions: [], rate: null, onOpenSession: () => {} };

describe('Observatorio', () => {
  it('with no telemetry shows only the empty state, not six zero cards', () => {
    const { container } = render(<Observatorio {...props} usageStats={empty} />);
    expect(container.textContent).toContain('Sem dados de uso ainda');
    expect(container.textContent).not.toContain('custo estimado');
  });

  it('with data shows the KPI cards', () => {
    const row = { sessionId: 's1', ctxTokens: 1000, outputTokens: 500, samples: 3, lastTs: Date.now(), model: null, requestedModel: null, costUsd: 1.5 };
    const { container } = render(<Observatorio {...props} usageStats={{ ...empty, sessions: [row], totalSamples: 3, totalCost: 1.5 }} />);
    expect(container.textContent).toContain('custo estimado');
  });
});
