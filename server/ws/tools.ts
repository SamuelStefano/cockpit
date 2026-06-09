import type { ToolCall } from '../../shared/protocol';
import { diffOf, planOf, questionsOf, extractCommand } from '../sessions/parse';
import { broadcast } from './broadcast';
import type { Thread } from './runs';

// Saída de tool (Read/Bash) pode trazer MBs (dump de arquivo/comando). Sem cap
// ela infla o frame ao vivo, o snapshot retido em thread.tools E o payload de
// replay no reconnect — o vetor real de OOM num run noturno (squad H2). A verdade
// completa fica no JSONL; aqui só a cauda do card precisa caber.
const TOOL_OUTPUT_CAP = 256 * 1024;
function capOutput(lines: string[]): string[] {
  let total = 0;
  const out: string[] = [];
  for (const ln of lines) {
    if (total + ln.length > TOOL_OUTPUT_CAP) {
      const room = TOOL_OUTPUT_CAP - total;
      if (room > 0) out.push(ln.slice(0, room));
      out.push('… (saída truncada — abra a sessão p/ ver tudo)');
      break;
    }
    total += ln.length + 1;
    out.push(ln);
  }
  return out;
}

// Teto de tools retidas por thread: um run de horas com centenas de tools não
// pode crescer sem limite na memória (cada entrada é re-serializada no replay).
const MAX_TOOLS = 300;

// Upsert por id no snapshot do thread (mesma lógica do client upsertTool):
// preserva campos do evento running (diff/command) ao mesclar o done.
function snapshotTool(thread: Thread, tool: ToolCall) {
  const i = thread.tools.findIndex((t) => t.id === tool.id);
  if (i === -1) thread.tools.push(tool);
  else {
    const prev = thread.tools[i];
    thread.tools[i] = {
      ...prev,
      ...tool,
      label: tool.label && tool.label !== 'tool' ? tool.label : prev.label,
      name: tool.name && tool.name !== 'tool' ? tool.name : prev.name,
      command: tool.command || prev.command,
      output: tool.output.length ? tool.output : prev.output,
    };
  }
  if (thread.tools.length > MAX_TOOLS) {
    // Some o toolStart das tools podadas: uma tool sem tool_result (run morto no
    // meio) nunca passa por closeTool, então sua chave em toolStart só seria
    // limpa aqui. Sem isto, um run de horas com >300 tools vaza timestamps.
    const dropped = thread.tools.splice(0, thread.tools.length - MAX_TOOLS);
    for (const d of dropped) thread.toolStart.delete(d.id);
  }
}

export function emitTool(thread: Thread, sessionKey: string, block: any, status: ToolCall['status']) {
  const id = block.id ?? '';
  if (id && !thread.toolStart.has(id)) thread.toolStart.set(id, Date.now());
  const tool: ToolCall = {
    id,
    name: block.name ?? 'tool',
    label: block.name ?? 'tool',
    command: extractCommand(block.input),
    status,
    diff: diffOf(block.name, block.input),
    markdown: planOf(block.name, block.input),
    questions: questionsOf(block.name, block.input),
    output: [],
  };
  snapshotTool(thread, tool);
  broadcast({ t: 'tool', sessionKey, tool });
}

export function closeTool(thread: Thread, sessionKey: string, c: any) {
  const isErr = !!c.is_error;
  const output = capOutput(Array.isArray(c.content)
    ? c.content.filter((x: any) => x?.type === 'text').map((x: any) => x.text)
    : typeof c.content === 'string' ? c.content.split('\n') : []);
  const id = c.tool_use_id ?? '';
  const start = thread.toolStart.get(id);
  if (start !== undefined) thread.toolStart.delete(id);
  const tool: ToolCall = {
    id,
    name: 'tool',
    label: 'tool',
    command: '',
    status: isErr ? 'error' : 'done',
    exit: isErr ? 1 : 0,
    output,
    expanded: true,
    durationMs: start !== undefined ? Date.now() - start : undefined,
  };
  snapshotTool(thread, tool);
  broadcast({ t: 'tool', sessionKey, tool });
}
