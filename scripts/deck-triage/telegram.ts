import { ACTIONS, isActionId, type ActionId } from './actions.ts';

const MAX_TEXT = 4000;

export interface TgUser { id: number }
export interface TgChat { id: number }
export interface TgMessage { message_id: number; chat: TgChat; from?: TgUser; text?: string }
export interface TgCallback { id: string; from: TgUser; message?: TgMessage; data?: string }
export interface TgUpdate { update_id: number; message?: TgMessage; callback_query?: TgCallback }

export type Inbound =
  | { type: 'action'; action: ActionId; ref: string; callbackId: string; messageId: number | null }
  | { type: 'command'; command: 'status' | 'help' }
  | { type: 'ignored'; reason: string };

// Both the chat and the sender must be the owner: a private chat id equals the user id,
// so a group the bot was added to, or someone forwarding a button, never passes.
export function classifyUpdate(u: TgUpdate, ownerId: number): Inbound {
  const cb = u.callback_query;
  if (cb) {
    if (cb.from?.id !== ownerId || cb.message?.chat?.id !== ownerId) return { type: 'ignored', reason: `callback de ${cb.from?.id}/${cb.message?.chat?.id}` };
    const m = /^a:([a-z_]{1,30}):([a-z0-9]{0,16})$/.exec(cb.data ?? '');
    if (!m) return { type: 'ignored', reason: 'callback_data malformado' };
    if (!isActionId(m[1])) return { type: 'ignored', reason: `ação desconhecida ${m[1]}` };
    return { type: 'action', action: m[1], ref: m[2], callbackId: cb.id, messageId: cb.message?.message_id ?? null };
  }
  const msg = u.message;
  if (msg) {
    if (msg.chat?.id !== ownerId || msg.from?.id !== ownerId) return { type: 'ignored', reason: `mensagem de ${msg.from?.id}/${msg.chat?.id}` };
    const cmd = (msg.text ?? '').trim().split(/[\s@]/)[0];
    if (cmd === '/status') return { type: 'command', command: 'status' };
    return { type: 'command', command: 'help' };
  }
  return { type: 'ignored', reason: 'update sem mensagem' };
}

export function actionButtons(actions: ActionId[], ref: string): { text: string; callback_data: string }[][] {
  const list = [...new Set([...actions.filter((a) => a !== 'ignore'), 'ignore' as const])];
  return list.map((a) => [{ text: ACTIONS[a].label, callback_data: `a:${a}:${ref}` }]);
}

export function createTelegram(token: string, fetchImpl: typeof fetch = fetch) {
  const call = async <T>(method: string, body: unknown, timeoutMs = 15_000): Promise<T> => {
    const res = await fetchImpl(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const j = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: T; description?: string };
    if (!res.ok || !j.ok) throw new Error(`telegram ${method}: HTTP ${res.status} ${String(j.description ?? '').slice(0, 120)}`);
    return j.result as T;
  };
  return {
    // No parse_mode: everything goes out as plain text.
    send(chatId: number, text: string, buttons?: { text: string; callback_data: string }[][]) {
      return call<TgMessage>('sendMessage', {
        chat_id: chatId,
        text: text.slice(0, MAX_TEXT),
        disable_web_page_preview: true,
        ...(buttons?.length ? { reply_markup: { inline_keyboard: buttons } } : {}),
      });
    },
    answer(callbackId: string, text: string) {
      return call<boolean>('answerCallbackQuery', { callback_query_id: callbackId, text: text.slice(0, 190) });
    },
    clearButtons(chatId: number, messageId: number) {
      return call<unknown>('editMessageReplyMarkup', { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] } });
    },
    updates(offset: number, timeoutSec = 50) {
      return call<TgUpdate[]>('getUpdates', { offset, timeout: timeoutSec, allowed_updates: ['message', 'callback_query'] }, (timeoutSec + 15) * 1000);
    },
  };
}

export type Telegram = ReturnType<typeof createTelegram>;
