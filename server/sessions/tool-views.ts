import type { ToolDiff, ToolQuestion, ToolTodo } from '../../shared/protocol';

// Extratores puros de `tool_use.input` → o que o card mostra. Ficam fora do parse
// porque o caminho AO VIVO (ws/tools.ts) usa exatamente os mesmos: o render tem que
// ser idêntico no stream e no histórico, e antes disso o live importava do parser
// de histórico só pra alcançá-los.

// Saída de tool pode trazer MBs (dump de arquivo/comando). Sem cap ela infla o
// payload de replay/histórico — vetor real de OOM (squad H2). A verdade completa
// fica no JSONL; aqui só a cauda do card precisa caber.
export const TOOL_OUTPUT_CAP = 256 * 1024;
export function capOutput(lines: string[]): string[] {
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

// Linhas de saída de um bloco tool_result, já capadas.
export function toolResultOutput(c: any): string[] {
  // Paridade: blocos `image` (screenshots de Playwright, saída de tools que
  // retornam imagem) eram filtrados → o card ficava vazio enquanto o terminal
  // mostra a indicação. Emite um placeholder por imagem em vez de descartar.
  return capOutput(Array.isArray(c?.content)
    ? c.content
        .filter((x: any) => x?.type === 'text' || x?.type === 'image')
        .map((x: any) => (x.type === 'image' ? '[imagem]' : String(x.text ?? '')))
    : typeof c?.content === 'string' ? c.content.split('\n') : []);
}

// Subagent (Agent no app, Task no Claude Code stock) carrega o tipo no input —
// sobe pro rótulo do card ("Agent · Explore"), como o terminal mostra. Sem isto
// o card dizia só "Agent" e o usuário não sabia QUAL agente rodou.
export function labelOf(name: unknown, input: unknown): string {
  const n = typeof name === 'string' && name ? name : 'tool';
  if ((n === 'Agent' || n === 'Task') && input && typeof input === 'object') {
    const t = (input as Record<string, unknown>).subagent_type;
    if (typeof t === 'string' && t) return `${n} · ${t}`;
  }
  return n;
}

// Linha de argumento por ferramenta. TaskCreate/TaskUpdate não têm nenhuma das
// chaves genéricas (subject/taskId ficavam de fora) — o card aparecia vazio,
// enquanto o terminal mostra o título da task. Demais tools seguem o fallback.
export function commandOf(name: unknown, input: unknown): string {
  if (input && typeof input === 'object') {
    const o = input as Record<string, unknown>;
    if (name === 'TaskCreate' && typeof o.subject === 'string' && o.subject) return o.subject;
    if (name === 'TaskUpdate' && (typeof o.taskId === 'string' || typeof o.taskId === 'number')) {
      const parts = [`#${o.taskId}`];
      if (typeof o.status === 'string' && o.status) parts.push(`→ ${o.status}`);
      if (typeof o.subject === 'string' && o.subject) parts.push(`· ${o.subject}`);
      return parts.join(' ');
    }
  }
  return extractCommand(input);
}

export function extractCommand(input: unknown): string {
  if (input && typeof input === 'object') {
    const o = input as Record<string, unknown>;
    // Ordem: Bash(command) → file-tools(file_path) → Grep/Glob(pattern) →
    // WebFetch(url) → WebSearch(query) → Task(description). Sem isto, esses
    // cards apareciam sem nenhuma linha de argumento.
    for (const key of ['command', 'file_path', 'pattern', 'url', 'query', 'description'] as const) {
      if (typeof o[key] === 'string' && o[key]) return o[key] as string;
    }
  }
  return '';
}

// Edit/Write carregam o conteúdo antes/depois no input — extrai pra render de
// diff colorido. Edit: old_string/new_string. Write: content (old vazio).
export function diffOf(name: unknown, input: unknown): ToolDiff | undefined {
  if (typeof name !== 'string' || !input || typeof input !== 'object') return undefined;
  const o = input as Record<string, unknown>;
  const path = typeof o.file_path === 'string' ? o.file_path : '';
  if (!path) return undefined;
  if (name === 'Edit' && typeof o.old_string === 'string' && typeof o.new_string === 'string') {
    return { path, old: o.old_string, new: o.new_string };
  }
  if (name === 'Write' && typeof o.content === 'string') {
    return { path, old: '', new: o.content };
  }
  // MultiEdit aplica vários old/new no mesmo arquivo; junta os hunks num par só
  // pro DiffView (sem isto, MultiEdit — muito usado — não mostrava diff nenhum).
  if (name === 'MultiEdit' && Array.isArray(o.edits)) {
    const edits = (o.edits as Array<Record<string, unknown>>).filter(
      (e) => e && typeof e.old_string === 'string' && typeof e.new_string === 'string',
    );
    if (edits.length) {
      return {
        path,
        old: edits.map((e) => e.old_string as string).join('\n'),
        new: edits.map((e) => e.new_string as string).join('\n'),
      };
    }
  }
  return undefined;
}

// ExitPlanMode carrega o plano (markdown) no input.plan — extrai pra render rico
// no card da ferramenta (o plano fica invisível sem isso; squad plan-mode).
export function planOf(name: unknown, input: unknown): string | undefined {
  if (name !== 'ExitPlanMode' || !input || typeof input !== 'object') return undefined;
  const plan = (input as Record<string, unknown>).plan;
  return typeof plan === 'string' && plan.trim() ? plan : undefined;
}

// AskUserQuestion carrega input.questions[] (cada uma: question/header/multiSelect/
// options[{label,description}]). O `claude -p` é single-shot com stdin ignorado, então
// a resposta não pode voltar no mesmo turno — extraímos as perguntas pra render de
// botões clicáveis e a escolha vira o PRÓXIMO prompt (resume continua). Sem isto, o
// card aparecia vazio e o usuário ficava travado num turno que espera input que nunca chega.
export function questionsOf(name: unknown, input: unknown): ToolQuestion[] | undefined {
  if (name !== 'AskUserQuestion' || !input || typeof input !== 'object') return undefined;
  const raw = (input as Record<string, unknown>).questions;
  if (!Array.isArray(raw)) return undefined;
  const questions: ToolQuestion[] = [];
  for (const q of raw) {
    if (!q || typeof q !== 'object') continue;
    const o = q as Record<string, unknown>;
    const question = typeof o.question === 'string' ? o.question : '';
    const header = typeof o.header === 'string' ? o.header : '';
    if (!question) continue;
    const opts = Array.isArray(o.options) ? o.options : [];
    const options = opts
      .filter((op): op is Record<string, unknown> => !!op && typeof op === 'object' && typeof (op as Record<string, unknown>).label === 'string')
      .map((op) => ({
        label: op.label as string,
        description: typeof op.description === 'string' ? op.description : undefined,
      }));
    if (!options.length) continue;
    questions.push({ question, header, multiSelect: o.multiSelect === true, options });
  }
  return questions.length ? questions : undefined;
}

// O conteúdo do assistant traz uma AskUserQuestion pronta (com perguntas válidas)?
// O turno precisa ENCERRAR aqui: o `claude -p` ficaria pendurado esperando um
// tool_result que nunca chega (stdin ignorado), e o card de escolha só destrava
// quando a fase volta a idle. Detecta pra o engine matar o run e a escolha virar
// o próximo prompt via --resume.
export function contentHasQuestion(content: unknown): boolean {
  if (!Array.isArray(content)) return false;
  return content.some((c: any) => c?.type === 'tool_use' && !!questionsOf(c?.name, c?.input)?.length);
}

// TodoWrite carrega input.todos[] (cada uma: content/status/activeForm). Extrai pra
// render do painel de tarefas no card (sem isto, TodoWrite virava card genérico sem
// a lista de itens). Status fora do enum vira 'pending' (JSONL não-confiável).
export function todosOf(name: unknown, input: unknown): ToolTodo[] | undefined {
  if (name !== 'TodoWrite' || !input || typeof input !== 'object') return undefined;
  const raw = (input as Record<string, unknown>).todos;
  if (!Array.isArray(raw)) return undefined;
  const todos: ToolTodo[] = [];
  for (const t of raw) {
    if (!t || typeof t !== 'object') continue;
    const o = t as Record<string, unknown>;
    const content = typeof o.content === 'string' ? o.content : '';
    if (!content) continue;
    const status = o.status === 'in_progress' || o.status === 'completed' ? o.status : 'pending';
    const activeForm = typeof o.activeForm === 'string' && o.activeForm ? o.activeForm : undefined;
    todos.push({ content, status, activeForm });
  }
  return todos.length ? todos : undefined;
}
