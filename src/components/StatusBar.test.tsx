// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { StatusBar } from './StatusBar';

afterEach(cleanup);

const stats = { cpu: 42, mem: { used: 2e9, total: 4e9 }, gpu: null, disk: { used: 10e9, total: 40e9 }, load: 1.5 };

describe('StatusBar meters', () => {
  it('expose their detail as a native title and an accessible name (no clipped hover bubble)', () => {
    const { getByRole } = render(<StatusBar stats={stats} />);
    const cpu = getByRole('group', { name: /^CPU 42% · load 1\.50$/ });
    expect(cpu.getAttribute('title')).toBe('CPU 42% · load 1.50');
    expect(getByRole('group', { name: /^RAM / })).toBeTruthy();
    expect(getByRole('group', { name: /^Disco / })).toBeTruthy();
  });
});
