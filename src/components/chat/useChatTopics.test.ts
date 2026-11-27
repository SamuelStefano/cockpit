// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useChatTopics } from './useChatTopics';
import type { Message } from '../../data/types';

const user = (id: string, text: string) => ({ id, role: 'user', text } as Message);
const asst = (id: string, md: string) => ({ id, role: 'assistant', blocks: [{ type: 'text', md }] } as unknown as Message);

describe('useChatTopics', () => {
  it('keeps the same topics array while only the streaming reply changes', () => {
    const ref = { current: null };
    const base = [user('u1', 'primeiro assunto longo'), asst('a1', 'x'), user('u2', 'segundo assunto longo'), asst('a2', 'y'), user('u3', 'terceiro assunto longo')];
    const { result, rerender } = renderHook(({ m }: { m: Message[] }) => useChatTopics(ref, m), { initialProps: { m: [...base, asst('a3', 'parcial')] } });
    const first = result.current.topics;
    rerender({ m: [...base, asst('a3', 'parcial com mais texto')] });
    expect(result.current.topics).toBe(first);
  });
});
