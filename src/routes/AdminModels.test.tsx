// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { AdminModels } from './AdminModels';
import { loadPref, setPref } from '../lib/persist';

afterEach(() => { cleanup(); setPref('hiddenModels', []); localStorage.clear(); });

const models = [
  { id: 'claude-opus-5', displayName: 'Opus 5' },
  { id: 'claude-haiku-4-5', displayName: 'Haiku 4.5' },
  { id: 'agent:grok', displayName: 'Grok · agente' },
];

describe('AdminModels', () => {
  it('hides a whole family, including future versions', () => {
    const { getByRole, queryByRole } = render(<AdminModels models={models} />);
    fireEvent.click(getByRole('switch', { name: /Mostrar Haiku/ }));
    expect(loadPref('hiddenModels', [])).toEqual(['family:haiku']);
    expect(queryByRole('switch', { name: /Haiku 4\.5/ })).toBeNull();
  });

  it('hides a single version and an agent by id', () => {
    const { getByRole } = render(<AdminModels models={models} />);
    fireEvent.click(getByRole('switch', { name: /^Opus 5/ }));
    fireEvent.click(getByRole('switch', { name: /Grok/ }));
    expect(loadPref('hiddenModels', [])).toEqual(['claude-opus-5', 'agent:grok']);
  });

  it('warns when everything is hidden and "Mostrar todos" clears the pref', () => {
    setPref('hiddenModels', ['family:opus', 'family:haiku', 'family:fable', 'family:sonnet', 'agent:grok']);
    const { getByRole, queryByRole } = render(<AdminModels models={models} />);
    expect(getByRole('alert').textContent).toContain('Todos os modelos estão ocultos');
    fireEvent.click(getByRole('button', { name: /Mostrar todos/ }));
    expect(loadPref('hiddenModels', ['x'])).toEqual([]);
    expect(queryByRole('alert')).toBeNull();
  });
});
