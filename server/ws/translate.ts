import type { ClaudeEvent } from '../engine/events';
import { recordUsage } from '../db';
import { ctxTokens, num, contentHasQuestion } from '../sessions/parse';
import { broadcast } from './broadcast';
import { applySlashCommands } from './slash';
import { setLastRate } from './rate';
import { emitTool, closeTool } from './tools';
import { getLastRate } from './rate';
import { parseTaskNotification, registerNotify } from './task-notify';
import { threads, type Thread } from './runs';

// Tradução evento NDJSON -> ServerMsg (squad C2/H1: tool por id de correlação).
export function translate(sessionKey: string, thread: Thread, ev: ClaudeEvent) {
  // Um re-send mata o run anterior e o substitui na mesma key, mas o kill é
  // assíncrono: o run morrendo ainda drena frames. Sem este guard, deltas/tools
  // do run velho se intercalam com os do novo na mesma sessionKey (o onClose já
  // tem o guard equivalente pro 'done').
  if (threads.get(sessionKey) !== thread) return;
  // Sinal de vida do turno: qualquer frame carimba o relógio. O reaper mata um
  // thread que fica sem frames além do teto de silêncio (garimpou 40min → morto).
  thread.lastFrameAt = Date.now();
  // Pós-pergunta: o `claude -p` auto-resolve o AskUserQuestion (tool_result falso) e
  // CONTINUA gerando no mesmo turno — a pergunta era enterrada (deixava de ser a
  // última mensagem) e o card nunca ficava respondível. Uma vez perguntado, descarta
  // todo conteúdo subsequente (deltas/thinking/tools/assistant/tool_result); só o
  // 'result' passa pra fechar o turno. A bolha congela na pergunta = respondível.
  // ...e idem após STOP: entre o SIGTERM e o SIGKILL (até 5s) o `claude` ainda
  // cospe NDJSON; sem este guard os deltas/tools pós-stop iam a broadcast e
  // "reacendiam" o turno na UI. stopped cobre stop do usuário E o auto-stop da
  // pergunta. Só o 'result'/'system' passam pra fechar o turno limpo.
  if ((thread.questioned || thread.stopped) && (ev.type === 'stream_event' || ev.type === 'assistant' || ev.type === 'user')) return;
  switch (ev.type) {
    case 'rate_limit_event': {
      const info = (ev as any).rate_limit_info;
      if (info) {
        // O CLI manda resetsAt em epoch SEGUNDOS; a UI compara com Date.now() (ms).
        // Normaliza pra ms aqui (guard: valores < 1e12 são claramente segundos).
        const raw = Number(info.resetsAt) || 0;
        const resetsAt = raw > 0 && raw < 1e12 ? raw * 1000 : raw;
        setLastRate({ resetsAt, status: info.status });
        broadcast({ t: 'rate', resetsAt, status: info.status });
      }
      capture(thread, ev);
      return;
    }
    case 'system': {
      capture(thread, ev);
      const sm = (ev as any).model;
      if (typeof sm === 'string' && sm) thread.model = sm;
      const sc = (ev as any).slash_commands;
      if (Array.isArray(sc) && sc.length) applySlashCommands(sc as string[]);
      // O CLI auto-compacta perto do limite e marca com este boundary (DR-012). Não
      // disparamos compactação — só observamos pra a UI resetar o medidor de contexto.
      if ((ev as any).subtype === 'compact_boundary') {
        const meta = (ev as any).compact_metadata ?? {};
        broadcast({ t: 'compact', sessionKey, trigger: meta.trigger, preTokens: meta.pre_tokens });
      }
      // Loop agendado acordou (terminal mostra "✻ Claude resuming…"): vira um
      // divisor fino no chat, senão a noite autônoma parece uma conversa contínua.
      if ((ev as any).subtype === 'scheduled_task_fire' && typeof (ev as any).content === 'string') {
        broadcast({ t: 'compact', sessionKey, kind: 'wakeup', label: (ev as any).content });
      }
      if (thread.sessionId) broadcast({ t: 'system', sessionKey, sessionId: thread.sessionId });
      return;
    }
    case 'stream_event': {
      const e = (ev as any).event;
      if (e?.type === 'content_block_delta' && e.delta?.type === 'text_delta' && e.delta.text) {
        thread.text = capTail(thread.text + e.delta.text);
        broadcast({ t: 'delta', sessionKey, text: e.delta.text });
      } else if (e?.type === 'content_block_delta' && e.delta?.type === 'thinking_delta' && e.delta.thinking) {
        thread.thinking = capTail(thread.thinking + e.delta.thinking);
        broadcast({ t: 'thinking', sessionKey, text: e.delta.thinking });
      } else if (e?.type === 'content_block_start' && e.content_block?.type === 'tool_use') {
        emitTool(thread, sessionKey, e.content_block, 'running');
      }
      capture(thread, ev);
      return;
    }
    case 'assistant': {
      const m = (ev as any).message?.model;
      if (typeof m === 'string' && m) thread.model = m;
      const content = (ev as any).message?.content;
      if (Array.isArray(content)) {
        for (const c of content) {
          if (c?.type === 'tool_use') { emitTool(thread, sessionKey, c, 'running'); continue; }
          // Paridade: text/thinking que chegam SÓ no evento `assistant` final (sem
          // deltas de stream — bloco curto, ou --include-partial-messages não cobriu)
          // eram perdidos ao vivo. Emite o sufixo ainda não mostrado (includes()
          // evita duplicar quando os deltas já entregaram).
          if (c?.type === 'text' && typeof c.text === 'string' && c.text && !thread.text.includes(c.text)) {
            thread.text = capTail(thread.text + c.text);
            broadcast({ t: 'delta', sessionKey, text: c.text });
          } else if (c?.type === 'thinking' && typeof c.thinking === 'string' && c.thinking && !thread.thinking.includes(c.thinking)) {
            thread.thinking = capTail(thread.thinking + c.thinking);
            broadcast({ t: 'thinking', sessionKey, text: c.thinking });
          }
        }
      }
      capture(thread, ev);
      const usage = (ev as any).message?.usage;
      const tokens = ctxTokens(usage);
      // Quota real do turno: CADA chamada API re-lê o contexto inteiro (cache read)
      // e tudo conta na cota. O result.usage reporta só a última chamada, então um
      // turno com N tool-calls aparecia ~N× menor que o gasto verdadeiro (#381).
      // Acumula aqui, com dedupe por message.id — a mesma chamada emite um evento
      // assistant POR content block, todos com o mesmo id e o mesmo usage.
      const msgId = (ev as any).message?.id;
      if (usage && typeof msgId === 'string' && msgId !== thread.lastBilledMsgId) {
        // Sem cache read no total do turno (mesma régua do turnStats histórico):
        // releitura de prefixo inflava o ticker pra dezenas de milhões.
        const billed = num(usage.input_tokens) + num(usage.output_tokens) + num(usage.cache_creation_input_tokens);
        if (billed > 0) {
          thread.lastBilledMsgId = msgId;
          thread.turnTokens = (thread.turnTokens ?? 0) + billed;
          thread.inputTokens = (thread.inputTokens ?? 0) + num(usage.input_tokens);
          thread.outputTokens = (thread.outputTokens ?? 0) + num(usage.output_tokens);
          // Dentro do dedupe de propósito: gravar por EVENTO duplicava a linha no
          // SQLite (~N blocos por chamada) e o SUM do observatório supercontava.
          recordUsage({
            sessionId: thread.sessionId ?? sessionKey,
            ctxTokens: tokens,
            outputTokens: num(usage.output_tokens),
            inputTokens: num(usage.input_tokens),
            cacheReadTokens: num(usage.cache_read_input_tokens),
            cacheCreationTokens: num(usage.cache_creation_input_tokens),
            model: (ev as any).message?.model,
          });
        }
      }
      // Emite DEPOIS de acumular: `tokens` = janela de contexto (medidor); `turnTokens`
      // = gasto real do turno até aqui (incl. cache), pro ticker ao vivo bater com o
      // terminal em vez da estimativa por chars de saída (centenas).
      if (tokens > 0) broadcast({ t: 'usage', sessionKey, tokens, turnTokens: thread.turnTokens });
      // AskUserQuestion: o `claude -p` (stdin ignorado) ficaria pendurado esperando o
      // tool_result, a fase nunca voltava a idle e o card de escolha não destravava
      // (answerable exige idle). Encerra o run agora — kill() é gracioso (não reporta
      // "claude saiu"); a escolha do usuário vira o próximo prompt via --resume.
      // stopped=true só pra não notificar "turno concluído" (o turno está aguardando você).
      if (!thread.stopped && contentHasQuestion(content)) {
        thread.stopped = true;
        thread.questioned = true;
        thread.handle.kill();
      }
      return;
    }
    case 'user': {
      const content = (ev as any).message?.content;
      // Notificação de subagente: nunca vira conteúdo de chat. Se o MESMO task-id
      // repete (zumbi parado no limite re-notificando a cada retomada), o turno
      // nunca fecha — encerra e emite UM banner de limite em vez de spam infinito.
      const tn = parseTaskNotification(content);
      if (tn) {
        if (registerNotify(thread.taskNotifies, tn) === 'loop' && tn.status !== 'completed') {
          thread.stopped = true; // suprime deltas remanescentes (guard no topo)
          thread.endReason = 'task_loop';
          broadcast({ t: 'error', sessionKey, message: 'Subagente em loop de notificação (provável limite de sessão) — turno encerrado.' });
          const rate = getLastRate();
          if (rate) broadcast({ t: 'rate', resetsAt: rate.resetsAt, status: rate.status });
          thread.handle.kill();
        }
        return;
      }
      if (Array.isArray(content)) {
        for (const c of content) {
          if (c?.type === 'tool_result') closeTool(thread, sessionKey, c);
        }
      }
      return;
    }
    case 'result': {
      const r = ev as any;
      // typeof NaN === 'number': um total_cost_usd NaN/negativo/Infinity do CLI
      // vazaria pro 'done' e pra UI. Exige finito e >= 0.
      if (Number.isFinite(r.total_cost_usd) && r.total_cost_usd >= 0) thread.costUsd = r.total_cost_usd;
      if (typeof r.duration_ms === 'number') thread.durationMs = r.duration_ms;
      if (typeof r.num_turns === 'number') thread.numTurns = r.num_turns;
      // Fallback: se nenhum evento assistant trouxe usage (ex.: erro precoce),
      // usa o result.usage — que cobre só a ÚLTIMA chamada API, não o turno todo.
      const u = r.usage;
      if (!thread.turnTokens && u && typeof u === 'object') {
        const inp = num(u.input_tokens);
        const out = num(u.output_tokens);
        const t = inp + out + num(u.cache_creation_input_tokens);
        if (t > 0) thread.turnTokens = t;
        if (inp > 0) thread.inputTokens = inp;
        if (out > 0) thread.outputTokens = out;
      }
      if (typeof r.subtype === 'string') thread.endReason = r.subtype;
      // Paridade/rede de segurança: se nenhum delta/assistant trouxe texto (streaming
      // falhou) mas o result carrega o texto final, emite agora. Guard de texto vazio
      // evita duplicar no caminho normal; !stopped pra não reacender um turno parado.
      if (!thread.stopped && !thread.text.trim() && typeof r.result === 'string' && r.result.trim()) {
        thread.text = capTail(r.result);
        broadcast({ t: 'delta', sessionKey, text: r.result });
      }
      capture(thread, ev);
      return;
    }
  }
}

// O snapshot text/thinking só existe pra replay no reconnect (#10) — a verdade
// completa fica no JSONL. Limita a cauda pra um run de horas com saída enorme
// não inflar a memória do thread nem o payload de replay. Os deltas ao vivo vão
// inteiros pro cliente conectado; só o snapshot é truncado.
const SNAPSHOT_CAP = 512 * 1024;
function capTail(s: string): string {
  return s.length > SNAPSHOT_CAP ? s.slice(s.length - SNAPSHOT_CAP) : s;
}

function capture(thread: Thread, ev: ClaudeEvent) {
  const sid = (ev as any).session_id;
  if (sid && !thread.sessionId) thread.sessionId = sid;
}
