// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { EMPTY_BUILDER_DRAFT } from '../../../shared/agent-builder';
import type { AgentBuildResult } from '../../cockpit/useTeam';
import { useBotBuilder } from './useBotBuilder';

const skills = [{ id: 'planilhas', name: 'Planilhas', description: 'Cria planilhas.', mtime: 0 }];
const reply = (reqId: string, text: string): AgentBuildResult => ({ reqId, ok: true, text });

function mount(initial = EMPTY_BUILDER_DRAFT) {
  const onBuild = vi.fn(() => true);
  const hook = renderHook(({ result }: { result: AgentBuildResult | null }) => useBotBuilder({ initial, skills, result, onBuild }), { initialProps: { result: null as AgentBuildResult | null } });
  return { ...hook, onBuild };
}

describe('useBotBuilder', () => {
  it('greets differently when editing', () => {
    expect(mount().result.current.turns[0].text).toMatch(/Oi!/);
    expect(mount({ ...EMPTY_BUILDER_DRAFT, name: 'ana' }).result.current.turns[0].text).toContain('ana');
  });

  it('sends the history and draft, then applies the model reply to the preview', () => {
    const { result, rerender, onBuild } = mount();
    act(() => result.current.setInput('um ajudante de planilhas'));
    act(() => result.current.send());
    const req = (onBuild.mock.calls[0] as unknown as [{ reqId: string; history: { role: string }[] }])[0];
    expect(req.history.map((t) => t.role)).toEqual(['assistant', 'user']);
    expect(result.current.pending).toBe(true);
    expect(result.current.input).toBe('');
    rerender({ result: reply(req.reqId, 'Fechado!\n```agente\n{"name":"ana","skills":["planilhas","zzz"]}\n```') });
    expect(result.current.pending).toBe(false);
    expect(result.current.draft).toMatchObject({ name: 'ana', skills: ['planilhas'] });
    expect(result.current.turns.at(-1)).toEqual({ role: 'assistant', text: 'Fechado!' });
  });

  it('ignores a result for another request', () => {
    const { result, rerender } = mount();
    act(() => result.current.setInput('oi'));
    act(() => result.current.send());
    rerender({ result: reply('outro', '```agente\n{"name":"x"}\n```') });
    expect(result.current.pending).toBe(true);
    expect(result.current.draft.name).toBe('');
  });

  it('surfaces a server error and lets the person retry', () => {
    const { result, rerender, onBuild } = mount();
    act(() => result.current.setInput('oi'));
    act(() => result.current.send());
    const reqId = (onBuild.mock.calls[0] as unknown as [{ reqId: string }])[0].reqId;
    rerender({ result: { reqId, ok: false, error: 'falhou' } });
    expect(result.current.error).toBe('falhou');
    expect(result.current.pending).toBe(false);
  });

  it('does not send blank text, and reports an offline socket', () => {
    const { result, onBuild } = mount();
    act(() => result.current.send());
    expect(onBuild).not.toHaveBeenCalled();
    onBuild.mockReturnValueOnce(false);
    act(() => result.current.setInput('oi'));
    act(() => result.current.send());
    expect(result.current.error).toMatch(/conexão/);
    expect(result.current.pending).toBe(false);
    expect(result.current.turns).toHaveLength(1);
  });

  it('toggles a skill by hand in the preview', () => {
    const { result } = mount();
    act(() => result.current.toggle('planilhas'));
    expect(result.current.draft.skills).toEqual(['planilhas']);
    act(() => result.current.toggle('planilhas'));
    expect(result.current.draft.skills).toEqual([]);
  });
});
