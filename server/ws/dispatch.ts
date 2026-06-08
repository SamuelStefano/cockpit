import type { WebSocket } from 'ws';
import type { ClientMsg } from '../../shared/protocol';
import type { Role } from '../auth';
import { listSessions, listArchived } from '../sessions/index';
import { searchSessions } from '../sessions/search';
import { listContexts, readContext } from '../contexts';
import { listSkills, readSkill, resolveSkillDeny } from '../skills';
import { saveAttachment } from '../attachments';
import { usageStats } from '../db';
import { hideSession, unhideSession, purgeSession, setTitle, setNote } from '../store';
import { parseSession, parseFullSession } from '../sessions/parse';
import { collectHealth } from '../health';
import { setEnv, unsetEnv, addMcp, removeMcp, installCli } from '../admin-ops';
import { CONFIG } from '../config';
import { send, broadcast } from './broadcast';
import { threads, startRun, routeSend, onStop } from './runs';

export async function handle(ws: WebSocket, msg: ClientMsg, role?: Role) {
  switch (msg.t) {
    case 'list': {
      const items = await listSessions();
      send(ws, { t: 'sessions', items });
      return;
    }
    case 'open': {
      const parsed = await parseSession(msg.sessionId);
      if (!parsed) { send(ws, { t: 'error', message: 'sessão inválida' }); return; }
      send(ws, { t: 'history', sessionId: msg.sessionId, messages: parsed.messages, tokens: parsed.tokens, truncated: parsed.truncated });
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
    case 'purge': {
      // "Excluir": some de tudo no cockpit (o .jsonl no disco fica intacto).
      await purgeSession(msg.sessionId);
      broadcast({ t: 'sessions', items: await listSessions() });
      broadcast({ t: 'archived', items: await listArchived() });
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
      // msg vem de JSON.parse cru: q não-string faria searchSessions().trim() lançar.
      const q = typeof msg.q === 'string' ? msg.q : '';
      send(ws, { t: 'search-results', q, items: await searchSessions(q) });
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
    // Admin write-ops (#162). authorize() já garante role admin (default-deny);
    // re-emite health depois de cada escrita p/ a UI refletir na hora.
    case 'admin-env-set': {
      const r = await setEnv(msg.name, msg.value);
      send(ws, { t: 'admin-op', ok: r.ok, message: r.message });
      send(ws, { t: 'health', health: await collectHealth() });
      return;
    }
    case 'admin-env-unset': {
      const r = await unsetEnv(msg.name);
      send(ws, { t: 'admin-op', ok: r.ok, message: r.message });
      send(ws, { t: 'health', health: await collectHealth() });
      return;
    }
    case 'admin-mcp-add': {
      const r = await addMcp(msg.name, { command: msg.command, url: msg.url });
      send(ws, { t: 'admin-op', ok: r.ok, message: r.message });
      send(ws, { t: 'health', health: await collectHealth() });
      return;
    }
    case 'admin-mcp-remove': {
      const r = await removeMcp(msg.name);
      send(ws, { t: 'admin-op', ok: r.ok, message: r.message });
      send(ws, { t: 'health', health: await collectHealth() });
      return;
    }
    case 'admin-cli-install': {
      // RCE → só loopback (box do dono). Fora do loopback (agente na VPS federada)
      // a instalação é negada mesmo pro admin.
      if (!CONFIG.localOnly) {
        send(ws, { t: 'admin-op', ok: false, message: 'instalação só no loopback' });
        return;
      }
      const r = await installCli(msg.name);
      send(ws, { t: 'admin-op', ok: r.ok, message: r.message });
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
      // Marca o stop ANTES do kill: limpa a fila (senão o onClose→drainPending
      // sobe a mensagem enfileirada) e bumpa a época (descarta mensagem em
      // triagem no momento do stop).
      onStop(msg.sessionKey);
      threads.get(msg.sessionKey)?.handle.kill();
      return;
    }
    case 'send': {
      // Skills selecionadas pela UI viram regras de negação das NÃO-selecionadas
      // (Skill(id)). Resolvido aqui (async) e passado adiante; vazio = todas ativas.
      const disallowedSkills = await resolveSkillDeny(msg.skills);
      // Sessão ocupada → triador decide o destino (esperar/responder/prioridade/
      // juntar). Livre → roda direto como antes.
      if (threads.has(msg.sessionKey)) {
        void routeSend(ws, msg.sessionKey, msg.text, msg.sessionId, msg.msgId, msg.mode, msg.model, msg.maxBudgetUsd, msg.bypass, role, disallowedSkills);
      } else {
        startRun(ws, msg.sessionKey, msg.text, msg.sessionId, msg.msgId, msg.mode, msg.model, msg.maxBudgetUsd, msg.bypass, role, disallowedSkills);
      }
      return;
    }
  }
}
