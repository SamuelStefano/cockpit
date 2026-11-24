// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { botFileKey, useBotFiles } from './useBotFiles';
import type { ClientMsg } from '../../shared/protocol';

const mount = () => {
  const sent: ClientMsg[] = [];
  const send = vi.fn((m: ClientMsg) => { sent.push(m); return true; });
  return { ...renderHook(() => useBotFiles(send)), sent };
};

describe('useBotFiles', () => {
  it('keeps the listing per bot', () => {
    const { result } = mount();
    const items = [{ path: 'a.md', size: 3, mtime: 1 }];
    act(() => { expect(result.current.onMsg({ t: 'team-files', botId: 'capo1', items })).toBe(true); });
    expect(result.current.botFiles.capo1).toEqual(items);
  });

  it('asks for a file once, then decodes text and images', () => {
    const { result, sent } = mount();
    act(() => { result.current.onBotFileGet('capo1', 'nota.md'); result.current.onBotFileGet('capo1', 'nota.md'); });
    expect(sent).toEqual([{ t: 'team-file-get', botId: 'capo1', path: 'nota.md' }]);
    expect(result.current.botFileData[botFileKey('capo1', 'nota.md')]).toEqual({ status: 'loading' });
    act(() => { result.current.onMsg({ t: 'team-file', botId: 'capo1', path: 'nota.md', mime: 'text/markdown', size: 6, dataB64: 'IyBvbMOh' }); });
    expect(result.current.botFileData[botFileKey('capo1', 'nota.md')]).toMatchObject({ status: 'ok', text: '# olá' });
    act(() => { result.current.onMsg({ t: 'team-file', botId: 'capo1', path: 'm.png', mime: 'image/png', size: 3, dataB64: 'cG5n' }); });
    expect(result.current.botFileData[botFileKey('capo1', 'm.png')]).toEqual({ status: 'ok', mime: 'image/png', size: 3, url: 'data:image/png;base64,cG5n' });
  });

  it('keeps the server refusal as an error', () => {
    const { result } = mount();
    act(() => { result.current.onMsg({ t: 'team-file', botId: 'capo1', path: '../x', error: 'caminho inválido' }); });
    expect(result.current.botFileData[botFileKey('capo1', '../x')]).toEqual({ status: 'error', error: 'caminho inválido' });
  });
});
