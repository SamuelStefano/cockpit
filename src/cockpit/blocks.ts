import type { Block, ToolCall } from '../data/mock';

export function upsertTool(blocks: Block[], tool: ToolCall): Block[] {
  const i = blocks.findIndex((b) => b.type === 'tool' && b.tool.id === tool.id);
  if (i >= 0) {
    const prev = (blocks[i] as { type: 'tool'; tool: ToolCall }).tool;
    // O update de "done"/"error" (tool_result) chega com placeholders genéricos
    // (label/name 'tool', command ''). Preserva os campos reais do "running".
    // diff/markdown/questions chegam só no 2º emit (evento `assistant` completo —
    // no `content_block_start` o input ainda vem vazio); preferir o valor que
    // chegou, senão o anterior. Sem isto, o diff colorido nunca aparecia ao vivo.
    const merged: ToolCall = {
      ...prev,
      status: tool.status,
      output: tool.output.length ? tool.output : prev.output,
      exit: tool.exit ?? prev.exit,
      expanded: tool.expanded ?? prev.expanded,
      durationMs: tool.durationMs ?? prev.durationMs,
      label: tool.label && tool.label !== 'tool' ? tool.label : prev.label,
      name: tool.name && tool.name !== 'tool' ? tool.name : prev.name,
      command: tool.command || prev.command,
      diff: tool.diff ?? prev.diff,
      markdown: tool.markdown ?? prev.markdown,
      questions: tool.questions ?? prev.questions,
    };
    const next = blocks.slice();
    next[i] = { type: 'tool', tool: merged };
    return next;
  }
  return [...blocks, { type: 'tool', tool }];
}

export function appendDelta(blocks: Block[], text: string): Block[] {
  const last = blocks[blocks.length - 1];
  if (last && last.type === 'text') {
    const next = blocks.slice();
    next[next.length - 1] = { type: 'text', md: last.md + text };
    return next;
  }
  return [...blocks, { type: 'text', md: text }];
}

export function appendThinking(blocks: Block[], text: string): Block[] {
  const last = blocks[blocks.length - 1];
  if (last && last.type === 'thinking') {
    const next = blocks.slice();
    next[next.length - 1] = { type: 'thinking', text: last.text + text, expanded: last.expanded };
    return next;
  }
  return [...blocks, { type: 'thinking', text }];
}
