import { describe, it, expect } from 'vitest';
import { parseTaskNotification, registerNotify } from './task-notify';

const XML = (id: string, status = 'completed') =>
  `<task-notification><task-id>${id}</task-id><status>${status}</status><result>x</result></task-notification>`;

describe('parseTaskNotification', () => {
  it('extrai id/status de content string', () => {
    expect(parseTaskNotification(XML('abc', 'running'))).toEqual({ taskId: 'abc', status: 'running' });
  });
  it('extrai de array de blocks text', () => {
    expect(parseTaskNotification([{ type: 'text', text: XML('def') }])).toEqual({ taskId: 'def', status: 'completed' });
  });
  it('null quando não é notificação', () => {
    expect(parseTaskNotification('só um texto normal')).toBeNull();
    expect(parseTaskNotification([{ type: 'tool_result', content: 'ok' }])).toBeNull();
  });
  it('null sem task-id', () => {
    expect(parseTaskNotification('<task-notification><status>done</status></task-notification>')).toBeNull();
  });
});

describe('registerNotify', () => {
  it('vira loop ao atingir o limite pro mesmo task-id', () => {
    const seen = new Map<string, number>();
    const tn = { taskId: 't1', status: 'running' };
    expect(registerNotify(seen, tn)).toBe('ok');
    expect(registerNotify(seen, tn)).toBe('ok');
    expect(registerNotify(seen, tn)).toBe('loop');
  });
  it('conta task-ids separadamente', () => {
    const seen = new Map<string, number>();
    expect(registerNotify(seen, { taskId: 'a', status: '' })).toBe('ok');
    expect(registerNotify(seen, { taskId: 'b', status: '' })).toBe('ok');
    expect(registerNotify(seen, { taskId: 'a', status: '' })).toBe('ok');
  });
});
