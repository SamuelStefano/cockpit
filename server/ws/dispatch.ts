import type { WebSocket } from 'ws';
import type { ClientMsg } from '../../shared/protocol';
import { listSessions, listArchived } from '../sessions/index';
import { searchSessions } from '../sessions/search';
import { listContexts, readContext } from '../contexts';
import { listSkills, readSkill } from '../skills';
import { saveAttachment } from '../attachments';
import { usageStats } from '../db';
import { hideSession, unhideSession, setTitle, setNote } from '../store';
import { parseSession, parseFullSession } from '../sessions/parse';
import { collectHealth } from '../health';
import { send, broadcast } from './broadcast';
import { threads, startRun, routeSend } from './runs';

export async function handle(ws: WebSocket, msg: ClientMsg) {
  switch (msg.t) {
    case 'list': {
      const items = await listSessions();
      send(ws, { t: 'sessions', items });
      return;
    }
    case 'open': {
      const parsed = await parseSession(msg.sessionId);
      if (!parsed) { send(ws, { t: 'error', message: 'sessão inválida' }); return; }
      send(ws, { t: 'history', sessionId: msg.sessionId, messages: parsed.messages, tokens: parsed.tokens });
      return;
    }
    case 'open-full': {
      const parsed = await parseFullSession(msg.sessionId);
      if (!parsed) { send(ws, { t: 'error', message: 'sessão inválida' }); return; }
      send(ws, { t: 'history', sessionId: msg.sessionId, messages: parsed.messages, tokens: parsed.tokens, full: true });
      return;
    }
    case 'hide': {
      await hideSession(msg.sessionId);
      send(ws, { t: 'sessions', items: await listSessions() });
      send(ws, { t: 'archived', items: await listArchived() });
      return;
    }
    case 'unhide': {
      await unhideSession(msg.sessionId);
      send(ws, { t: 'sessions', items: await listSessions() });
      send(ws, { t: 'archived', items: await listArchived() });
      return;
    }
    case 'list-archived': {
      send(ws, { t: 'archived', items: await listArchived() });
      return;
    }
    case 'set-meta': {
      // Override manual de título/descrição (texto vazio limpa). Re-broadcast da
      // lista p/ todos os clientes verem o novo rótulo na hora.
      if (typeof msg.title === 'string') await setTitle(msg.sessionId, msg.title);
      if (typeof msg.summary === 'string') await setNote(msg.sessionId, msg.summary);
      broadcast({ t: 'sessions', items: await listSessions() });
      return;
    }
    case 'search': {
      send(ws, { t: 'search-results', q: msg.q, items: await searchSessions(msg.q) });
      return;
    }
    case 'ctx-list': {
      send(ws, { t: 'contexts', items: await listContexts() });
      return;
    }
    case 'ctx-open': {
      const c = await readContext(msg.id);
      if (c) send(ws, { t: 'context', id: msg.id, title: c.title, body: c.body });
      return;
    }
    case 'skill-list': {
      send(ws, { t: 'skills', items: await listSkills() });
      return;
    }
    case 'skill-open': {
      const s = await readSkill(msg.id);
      if (s) send(ws, { t: 'skill', id: msg.id, name: s.name, body: s.body });
      return;
    }
    case 'usage-list': {
      send(ws, { t: 'usage-stats', stats: usageStats() });
      return;
    }
    case 'admin-health': {
      send(ws, { t: 'health', health: await collectHealth() });
      return;
    }
    case 'upload': {
      const r = await saveAttachment(msg.sessionKey, msg.name, msg.dataB64);
      if ('error' in r) send(ws, { t: 'error', message: r.error });
      else send(ws, { t: 'uploaded', name: msg.name, path: r.path });
      return;
    }
    case 'stop': {
      threads.get(msg.sessionKey)?.handle.kill();
      return;
    }
    case 'send': {
      // Sessão ocupada → triador decide o destino (esperar/responder/prioridade/
      // juntar). Livre → roda direto como antes.
      if (threads.has(msg.sessionKey)) {
        void routeSend(ws, msg.sessionKey, msg.text, msg.sessionId, msg.msgId, msg.mode, msg.model, msg.effort, msg.maxBudgetUsd, msg.bypass);
      } else {
        startRun(ws, msg.sessionKey, msg.text, msg.sessionId, msg.msgId, msg.mode, msg.model, msg.effort, msg.maxBudgetUsd, msg.bypass);
      }
      return;
    }
  }
}
