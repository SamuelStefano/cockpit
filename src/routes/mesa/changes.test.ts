import { describe, expect, it } from 'vitest';
import type { AssistantMessage } from '../../../shared/protocol';
import { mesaChanges } from './changes';

function turn(blocks: AssistantMessage['blocks']): AssistantMessage {
  return { id: 'a', role: 'assistant', blocks };
}

describe('mesaChanges', () => {
  it('keeps file edits and commands, newest last, and skips a plain read', () => {
    const cards = mesaChanges([
      turn([
        { type: 'tool', tool: { id: '1', name: 'read_file', label: 'ler', command: '', status: 'done', output: [] } },
        { type: 'tool', tool: { id: '2', name: 'search_replace', label: 'editar', command: '', status: 'done', output: [], diff: { path: 'src/App.tsx', old: 'a', new: 'botão novo\n' } } },
      ]),
      turn([
        { type: 'tool', tool: { id: '3', name: 'run_terminal_command', label: 'teste', command: 'npx vitest run', status: 'running', output: [] } },
      ]),
    ]);
    expect(cards.map((c) => c.id)).toEqual(['2', '3']);
    expect(cards[0]).toMatchObject({ kind: 'arquivo', title: 'src/App.tsx', line: 'botão novo' });
    expect(cards[1]).toMatchObject({ kind: 'comando', status: 'running', line: 'npx vitest run' });
  });
});
