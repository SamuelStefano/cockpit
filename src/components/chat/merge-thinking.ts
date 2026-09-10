import type { Block } from '../../data/types';
import type { ShownMessage } from './shown';

type Assistant = Extract<ShownMessage, { role: 'assistant' }>;

const runCache = new WeakMap<ShownMessage, { members: ShownMessage[]; node: ShownMessage }>();
const blocksCache = new WeakMap<ShownMessage, { blocks: Block[]; node: ShownMessage }>();

// No histórico cada resposta da API é uma mensagem. Com as ferramentas já tiradas
// pro digest, um turno agêntico sobra como dezenas de bolhas só com "raciocínio
// interno", cada uma com avatar e rótulo de modelo — a thread virava uma parede.
// Aqui um run de bolhas só-de-pensamento vira UMA bolha, e pensamentos colados
// dentro da mesma bolha (turno ao vivo) viram um card só.
export function mergeThinking(messages: ShownMessage[]): ShownMessage[] {
  const out: ShownMessage[] = [];
  let run: Assistant[] = [];

  const flush = () => {
    if (run.length === 1) out.push(joinAdjacent(run[0]));
    else if (run.length) out.push(runNode(run));
    run = [];
  };

  for (const m of messages) {
    if (m.role !== 'assistant' || !isThinkingOnly(m)) {
      flush();
      out.push(m.role === 'assistant' ? joinAdjacent(m) : m);
      continue;
    }
    run.push(m);
    // A bolha com as stats do `result` fecha o turno: o próximo run é outro turno.
    if (m.stats) flush();
  }
  flush();
  return out;
}

function isThinkingOnly(m: Assistant): boolean {
  return !m.digest && !m.narration && !m.error && !m.quick
    && m.blocks.length > 0 && m.blocks.every((b) => b.type === 'thinking');
}

// O nó herda a ÚLTIMA bolha (stats e "Pensou por X" do fecho) mas mantém o id da
// primeira: o id é a key do React, e trocar a cada resposta nova remontaria a linha.
function runNode(run: Assistant[]): ShownMessage {
  const first = run[0];
  const hit = runCache.get(first);
  if (hit && hit.members.length === run.length && hit.members.every((m, i) => m === run[i])) return hit.node;
  const node: ShownMessage = { ...run[run.length - 1], id: first.id, ts: first.ts, blocks: joinThinking(run.flatMap((m) => m.blocks)) };
  runCache.set(first, { members: run, node });
  return node;
}

function joinAdjacent(m: Assistant): ShownMessage {
  if (!m.blocks.some((b, i) => b.type === 'thinking' && m.blocks[i - 1]?.type === 'thinking')) return m;
  const hit = blocksCache.get(m);
  if (hit && hit.blocks === m.blocks) return hit.node;
  const node: ShownMessage = { ...m, blocks: joinThinking(m.blocks) };
  blocksCache.set(m, { blocks: m.blocks, node });
  return node;
}

function joinThinking(blocks: Block[]): Block[] {
  const out: Block[] = [];
  for (const b of blocks) {
    const prev = out[out.length - 1];
    if (b.type === 'thinking' && prev?.type === 'thinking') {
      out[out.length - 1] = { type: 'thinking', text: `${prev.text}\n\n${b.text}` };
    } else {
      out.push(b);
    }
  }
  return out;
}
