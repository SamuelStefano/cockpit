// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { Tabs } from './Tabs';
import { ProgressBar } from './ProgressBar';

afterEach(cleanup);

describe('Tabs', () => {
  it('exposes a tablist with the active tab selected', () => {
    const { getByRole } = render(<Tabs items={[{ id: 'a', label: 'Um' }, { id: 'b', label: 'Dois' }]} active="b" onChange={() => {}} />);
    expect(getByRole('tablist')).toBeTruthy();
    expect(getByRole('tab', { name: 'Dois' }).getAttribute('aria-selected')).toBe('true');
    expect(getByRole('tab', { name: 'Um' }).getAttribute('aria-selected')).toBe('false');
  });

  it('compact drops the tab icons and tightens padding only below sm', () => {
    const items = [{ id: 'a' as const, label: 'Um', icon: 'search' as const }];
    const { getByRole, rerender } = render(<Tabs items={items} active="a" onChange={() => {}} compact />);
    expect(getByRole('tab').querySelector('svg')?.getAttribute('class')).toContain('max-sm:hidden');
    expect(getByRole('tab').className).toContain('max-sm:px-2');
    rerender(<Tabs items={items} active="a" onChange={() => {}} />);
    expect(getByRole('tab').querySelector('svg')?.getAttribute('class') ?? '').not.toContain('max-sm:hidden');
  });
});

describe('ProgressBar', () => {
  it('speaks its segment labels as one summary', () => {
    const { getByRole } = render(<ProgressBar segments={[{ value: 1, tone: 'green', label: 'faturado: R$ 1' }, { value: 2, tone: 'track', label: 'livre: R$ 2' }]} />);
    expect(getByRole('img').getAttribute('aria-label')).toBe('faturado: R$ 1 · livre: R$ 2');
  });
});
