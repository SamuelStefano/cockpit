import type { Message } from '../../../shared/protocol';

export interface MesaChange {
  id: string;
  title: string;
  status: 'running' | 'done' | 'error';
  kind: 'arquivo' | 'comando';
  line: string;
}

function firstLine(text: string): string {
  return text.split('\n').map((l) => l.trim()).find(Boolean)?.slice(0, 160) ?? '';
}

export function mesaChanges(messages: Message[], limit = 8): MesaChange[] {
  const out: MesaChange[] = [];
  for (const message of messages) {
    if (message.role !== 'assistant') continue;
    for (const block of message.blocks) {
      if (block.type !== 'tool') continue;
      const tool = block.tool;
      if (tool.diff) {
        out.push({
          id: tool.id,
          title: tool.diff.path,
          status: tool.status,
          kind: 'arquivo',
          line: firstLine(tool.diff.new),
        });
      } else if (tool.command) {
        out.push({
          id: tool.id,
          title: tool.label || tool.name,
          status: tool.status,
          kind: 'comando',
          line: firstLine(tool.command),
        });
      }
    }
  }
  return out.slice(-limit);
}
