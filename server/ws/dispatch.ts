import type { WebSocket } from 'ws';
import type { ClientMsg } from '../../shared/protocol';
import type { Role } from '../auth';
import { listSessions, listArchived } from '../sessions/index';
import { searchSessions } from '../sessions/search';
import { listContexts, readContext, installContext } from '../contexts';
import { getNotes, saveNotes } from '../notes';
import { getCrons, saveCron, deleteCron } from '../crons';
import { fireCron } from './runs';
import { listSkills, readSkill, resolveSkillDeny, installSkill } from '../skills';
import { saveAttachment, saveAttachmentFromUrl, addUploadChunk, readAttachment } from '../attachments';
import { s3Config } from '../s3';
import { usageStats } from '../db';
import { hideSession, unhideSession, purgeSession, setTitle, setNote } from '../store';
import { parseSession, parseFullSession } from '../sessions/parse';
import { collectHealth } from '../health';
import { setEnv, unsetEnv, addMcp, removeMcp, installCli } from '../admin-ops';
import { CONFIG } from '../config';
import { send, broadcast } from './broadcast';
import { threads, startRun, routeSend, onStop } from './runs';
import { refreshModels } from './models';
import { listGraphs, readGraph, buildGraph, deleteGraph, queryGraph, nodeOp } from '../graph';

export async function handle(ws: WebSocket, msg: ClientMsg, role?: Role) {
  switch (msg.t) {
    case 'graph-list': {
      send(ws, { t: 'graphs', items: await listGraphs() });
      return;
    }
    case 'graph-open': {
      const graph = await readGraph(msg.id);
      if (!graph) { send(ws, { t: 'error', message: 'grafo não encontrado' }); return; }
      send(ws, { t: 'graph-data', id: msg.id, graph });
      return;
    }
    case 'graph-query': {
      const res = await queryGraph(msg.id, msg.question, msg.budget);
      if (!res) { send(ws, { t: 'error', message: 'grafo não encontrado' }); return; }
      send(ws, { t: 'graph-query-result', id: msg.id, question: msg.question, answer: res.answer, tokens: res.tokens, miss: res.miss });
      return;
    }
    case 'graph-node-op': {
      const res = await nodeOp(msg.id, msg.op, msg.a, msg.b);
      if (!res) { send(ws, { t: 'error', message: 'operação inválida no grafo' }); return; }
      const label = msg.op === 'explain' ? `explicar ${msg.a}` : msg.op === 'affected' ? `impacto de ${msg.a}` : `caminho ${msg.a} → ${msg.b}`;
      send(ws, { t: 'graph-query-result', id: msg.id, question: label, answer: res.answer, tokens: res.tokens, miss: res.miss });
      return;
    }
    case 'graph-build': {
      // Progresso em streaming: o graphify loga o avanço da extração no stdout; cada
      // linha vira um frame p/ a UI mostrar o build vivo. build é longo (spawn AST).
      const result = await buildGraph(msg.repo, (line) => send(ws, { t: 'graph-build-progress', line }));
      send(ws, { t: 'graph-build-done', ok: result.ok, id: result.id, error: result.error });
      if (result.ok && result.id) {
        send(ws, { t: 'graphs', items: await listGraphs() });
        const graph = await readGraph(result.id);
        if (graph) send(ws, { t: 'graph-data', id: result.id, graph });
      }
      return;
    }
    case 'graph-delete': {
      const ok = await deleteGraph(msg.id);
      if (!ok) { send(ws, { t: 'error', message: 'não foi possível excluir o grafo' }); return; }
      send(ws, { t: 'graphs', items: await listGraphs() });
      return;
    }
    case 'list': {
      const items = await listSessions();
      send(ws, { t: 'sessions', items });
      return;
    }
    case 'open': {
      const parsed = await parseSession(msg.sessionId);
      if (!parsed) { send(ws, { t: 'error', message: 'sessão inválida' }); return; }
      send(ws, { t: 'history', sessionId: msg.sessionId, messages: parsed.messages, tokens: parsed.tokens, truncated: parsed.truncated, todos: parsed.todos });
      return;
    }
    case 'open-full': {
      const parsed = await parseFullSession(msg.sessionId);
      if (!parsed) { send(ws, { t: 'error', message: 'sessão inválida' }); return; }
      send(ws, { t: 'history', sessionId: msg.sessionId, messages: parsed.messages, tokens: parsed.tokens, full: true, truncated: parsed.truncated, todos: parsed.todos });
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
    case 'notes-get': {
      send(ws, { t: 'notes', text: await getNotes() });
      return;
    }
    case 'notes-save': {
      await saveNotes(msg.text);
      return;
    }
    case 'crons-get': {
      send(ws, { t: 'crons', items: await getCrons() });
      return;
    }
    case 'cron-save': {
      const c = msg.cron;
      // Validação mínima da borda (frame cru): só persiste um cron bem-formado.
      if (!c || typeof c.id !== 'string' || !/^[a-zA-Z0-9_-]{1,59}$/.test(c.id) ||
          typeof c.prompt !== 'string' || !c.prompt.trim() ||
          !c.schedule || (c.schedule.kind !== 'interval' && c.schedule.kind !== 'daily')) {
        send(ws, { t: 'error', message: 'cron inválido' });
        return;
      }
      send(ws, { t: 'crons', items: await saveCron(c) });
      return;
    }
    case 'cron-delete': {
      send(ws, { t: 'crons', items: await deleteCron(msg.id) });
      return;
    }
    case 'cron-run': {
      const all = await getCrons();
      const c = all.find((x) => x.id === msg.id);
      if (c) fireCron(c);
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
    // Compartilhamento (write-path, admin-only via authz): grava um contexto/skill
    // importado na própria conta. Guards (slug/imported-/anti-traversal/cap) nas fns.
    case 'ctx-install': {
      const r = await installContext(msg.slug, msg.title, msg.body);
      send(ws, 'error' in r ? { t: 'install-result', kind: 'context', ok: false, error: r.error } : { t: 'install-result', kind: 'context', ok: true, id: r.id });
      if (!('error' in r)) send(ws, { t: 'contexts', items: await listContexts() });
      return;
    }
    case 'skill-install': {
      const r = await installSkill(msg.slug, msg.title, msg.body);
      send(ws, 'error' in r ? { t: 'install-result', kind: 'skill', ok: false, error: r.error } : { t: 'install-result', kind: 'skill', ok: true, id: r.id });
      if (!('error' in r)) send(ws, { t: 'skills', items: await listSkills() });
      return;
    }
    case 'usage-list': {
      send(ws, { t: 'usage-stats', stats: usageStats() });
      return;
    }
    case 'refresh-models': {
      // Puxa /v1/models na hora (em vez de esperar o poll horário) e re-broadcasta
      // a lista nova pra todos, pra um modelo recém-lançado aparecer no seletor.
      const models = await refreshModels();
      if (models.length) broadcast({ t: 'models', models });
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
      // MCP stdio = subprocesso arbitrário que o `claude` spawna depois → RCE.
      // Mesmo gate do cli-install: stdio só no loopback. URL (http) pode remoto.
      if (msg.command && !CONFIG.localOnly) {
        send(ws, { t: 'admin-op', ok: false, message: 'MCP stdio só no loopback' });
        return;
      }
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
      else send(ws, { t: 'uploaded', name: msg.name, path: r.path, text: r.text, s3url: r.s3url, clientId: msg.clientId });
      return;
    }
    // Upload em chunks via WS (caminho robusto): o backend remonta e sobe pro S3
    // server-side. null = ainda faltam chunks (não responde).
    case 'upload-chunk': {
      const r = await addUploadChunk(msg.uploadId, msg.sessionKey, msg.name, msg.seq, msg.total, msg.dataB64);
      if (r === null) return;
      if ('error' in r) send(ws, { t: 'error', message: r.error });
      else send(ws, { t: 'uploaded', name: msg.name, path: r.path, text: r.text, s3url: r.s3url, clientId: msg.clientId });
      return;
    }
    // Upload direto na edge fn: o browser pede a config (URL+anon key, só após o gate
    // de auth do WS — nunca hardcoded no bundle público) e sobe o arquivo por HTTP.
    case 's3-config': {
      const cfg = s3Config();
      if (cfg) send(ws, { t: 's3-config', uploadUrl: cfg.uploadUrl, anonKey: cfg.anonKey });
      return;
    }
    // O browser já subiu pro S3 e manda só a URL; o backend baixa pro workdir local
    // (pro Read do agente). clientId ecoa pra o front casar com o chip otimista.
    case 'attach-ref': {
      const r = await saveAttachmentFromUrl(msg.sessionKey, msg.name, msg.s3url);
      if ('error' in r) send(ws, { t: 'error', message: r.error });
      else send(ws, { t: 'uploaded', name: msg.name, path: r.path, text: r.text, s3url: r.s3url, clientId: msg.clientId });
      return;
    }
    case 'att-open': {
      const r = await readAttachment(msg.path);
      if ('error' in r) send(ws, { t: 'attachment', path: msg.path, name: msg.path, error: r.error });
      else send(ws, { t: 'attachment', path: msg.path, name: r.name, dataB64: r.dataB64 });
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
        void routeSend(ws, msg.sessionKey, msg.text, msg.sessionId, msg.msgId, msg.mode, msg.model, msg.maxBudgetUsd, msg.bypass, role, disallowedSkills, msg.mcps, msg.effort);
      } else {
        startRun(ws, msg.sessionKey, msg.text, msg.sessionId, msg.msgId, msg.mode, msg.model, msg.maxBudgetUsd, msg.bypass, role, disallowedSkills, msg.mcps, msg.effort);
      }
      return;
    }
  }
}
