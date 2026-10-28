import { describe, expect, it } from 'vitest';
import { actionButtons, classifyUpdate, type TgUpdate } from './telegram.ts';

const OWNER = 8831502964;
const cb = (fromId: number, chatId: number, data: string): TgUpdate => ({
  update_id: 1, callback_query: { id: 'q', from: { id: fromId }, data, message: { message_id: 9, chat: { id: chatId } } },
});
const msg = (fromId: number, chatId: number, text: string): TgUpdate => ({ update_id: 1, message: { message_id: 3, chat: { id: chatId }, from: { id: fromId }, text } });

describe('classifyUpdate', () => {
  it('accepts an allowlisted action from the owner in the owner chat', () => {
    expect(classifyUpdate(cb(OWNER, OWNER, 'a:restart_relay:ab12'), OWNER)).toEqual({ type: 'action', action: 'restart_relay', ref: 'ab12', callbackId: 'q', messageId: 9 });
  });

  it.each([
    ['another user in the owner chat', cb(123, OWNER, 'a:restart_relay:x')],
    ['the owner in a group chat', cb(OWNER, -100123, 'a:restart_relay:x')],
    ['a stranger in their own chat', cb(123, 123, 'a:restart_relay:x')],
  ])('ignores a callback from %s', (_, u) => {
    expect(classifyUpdate(u, OWNER).type).toBe('ignored');
  });

  it('refuses an unknown action and malformed data', () => {
    expect(classifyUpdate(cb(OWNER, OWNER, 'a:rm_rf:x'), OWNER)).toMatchObject({ type: 'ignored', reason: expect.stringContaining('desconhecida') });
    expect(classifyUpdate(cb(OWNER, OWNER, 'a:restart_relay:x; reboot'), OWNER).type).toBe('ignored');
    expect(classifyUpdate(cb(OWNER, OWNER, 'a:__proto__:x'), OWNER).type).toBe('ignored');
  });

  it('runs /status only for the owner', () => {
    expect(classifyUpdate(msg(OWNER, OWNER, '/status'), OWNER)).toEqual({ type: 'command', command: 'status' });
    expect(classifyUpdate(msg(OWNER, OWNER, '/status@Deck_Ops_bot'), OWNER)).toEqual({ type: 'command', command: 'status' });
    expect(classifyUpdate(msg(5, 5, '/status'), OWNER).type).toBe('ignored');
    expect(classifyUpdate(msg(5, OWNER, '/status'), OWNER).type).toBe('ignored');
  });
});

describe('actionButtons', () => {
  it('always ends with Ignorar and fits Telegram 64-byte callback data', () => {
    const rows = actionButtons(['restart_relay', 'redeploy_web'], 'abcdef123');
    expect(rows.map((r) => r[0].text)).toEqual(['Reiniciar relay', 'Redeploy deck-web', 'Ignorar']);
    for (const r of rows) expect(Buffer.byteLength(r[0].callback_data)).toBeLessThanOrEqual(64);
  });
});
