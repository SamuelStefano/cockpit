import { describe, it, expect } from 'vitest';
import { diffOf, planOf, questionsOf, contentHasQuestion, todosOf, extractCommand, labelOf, commandOf, capOutput, TOOL_OUTPUT_CAP } from './tool-views';

describe('diffOf', () => {
  it('extracts Edit old/new', () => {
    expect(diffOf('Edit', { file_path: '/a.ts', old_string: 'x', new_string: 'y' }))
      .toEqual({ path: '/a.ts', old: 'x', new: 'y' });
  });
  it('treats Write content as new with empty old', () => {
    expect(diffOf('Write', { file_path: '/a.ts', content: 'hello' }))
      .toEqual({ path: '/a.ts', old: '', new: 'hello' });
  });
  it('joins MultiEdit hunks into one pair', () => {
    const d = diffOf('MultiEdit', { file_path: '/a.ts', edits: [
      { old_string: 'a', new_string: 'A' },
      { old_string: 'b', new_string: 'B' },
    ] });
    expect(d).toEqual({ path: '/a.ts', old: 'a\nb', new: 'A\nB' });
  });
  it('returns undefined without a file_path', () => {
    expect(diffOf('Edit', { old_string: 'x', new_string: 'y' })).toBeUndefined();
  });
  it('returns undefined for non-diff tools', () => {
    expect(diffOf('Bash', { command: 'ls' })).toBeUndefined();
  });
});

describe('planOf', () => {
  it('extracts ExitPlanMode plan', () => {
    expect(planOf('ExitPlanMode', { plan: '# Plano' })).toBe('# Plano');
  });
  it('ignores blank or wrong tools', () => {
    expect(planOf('ExitPlanMode', { plan: '   ' })).toBeUndefined();
    expect(planOf('Edit', { plan: 'x' })).toBeUndefined();
  });
});

describe('questionsOf', () => {
  const input = {
    questions: [
      {
        question: 'Qual abordagem?',
        header: 'Abordagem',
        multiSelect: false,
        options: [
          { label: 'A', description: 'desc A' },
          { label: 'B' },
        ],
      },
    ],
  };
  it('extracts AskUserQuestion questions', () => {
    const q = questionsOf('AskUserQuestion', input);
    expect(q).toHaveLength(1);
    expect(q![0].question).toBe('Qual abordagem?');
    expect(q![0].header).toBe('Abordagem');
    expect(q![0].multiSelect).toBe(false);
    expect(q![0].options).toEqual([
      { label: 'A', description: 'desc A' },
      { label: 'B', description: undefined },
    ]);
  });
  it('ignores wrong tool or bad shape', () => {
    expect(questionsOf('Edit', input)).toBeUndefined();
    expect(questionsOf('AskUserQuestion', {})).toBeUndefined();
    expect(questionsOf('AskUserQuestion', { questions: [] })).toBeUndefined();
  });
  it('drops questions without text or options', () => {
    expect(questionsOf('AskUserQuestion', { questions: [{ question: '', options: [{ label: 'X' }] }] })).toBeUndefined();
    expect(questionsOf('AskUserQuestion', { questions: [{ question: 'q', options: [] }] })).toBeUndefined();
  });
});

describe('contentHasQuestion', () => {
  const q = { type: 'tool_use', name: 'AskUserQuestion', input: { questions: [{ question: 'q', options: [{ label: 'A' }] }] } };
  it('detecta AskUserQuestion válida no conteúdo do assistant', () => {
    expect(contentHasQuestion([{ type: 'text', text: 'oi' }, q])).toBe(true);
  });
  it('ignora conteúdo sem pergunta', () => {
    expect(contentHasQuestion([{ type: 'text', text: 'oi' }])).toBe(false);
    expect(contentHasQuestion([{ type: 'tool_use', name: 'Edit', input: {} }])).toBe(false);
    expect(contentHasQuestion('texto')).toBe(false);
    expect(contentHasQuestion(undefined)).toBe(false);
  });
});

describe('todosOf', () => {
  const input = {
    todos: [
      { content: 'Ler arquivo', status: 'completed' },
      { content: 'Rodar testes', status: 'in_progress', activeForm: 'Rodando testes' },
      { content: 'Abrir PR', status: 'pending' },
    ],
  };
  it('extracts TodoWrite todos', () => {
    const t = todosOf('TodoWrite', input);
    expect(t).toHaveLength(3);
    expect(t![0]).toEqual({ content: 'Ler arquivo', status: 'completed', activeForm: undefined });
    expect(t![1]).toEqual({ content: 'Rodar testes', status: 'in_progress', activeForm: 'Rodando testes' });
    expect(t![2].status).toBe('pending');
  });
  it('coerces unknown status to pending', () => {
    const t = todosOf('TodoWrite', { todos: [{ content: 'X', status: 'weird' }] });
    expect(t![0].status).toBe('pending');
  });
  it('ignores wrong tool or bad shape', () => {
    expect(todosOf('Edit', input)).toBeUndefined();
    expect(todosOf('TodoWrite', {})).toBeUndefined();
    expect(todosOf('TodoWrite', { todos: [] })).toBeUndefined();
    expect(todosOf('TodoWrite', { todos: [{ content: '', status: 'pending' }] })).toBeUndefined();
  });
});

describe('extractCommand', () => {
  it('prefers command over other keys', () => {
    expect(extractCommand({ command: 'ls -la', file_path: '/a.ts' })).toBe('ls -la');
  });
  it('falls back through the key precedence list', () => {
    expect(extractCommand({ file_path: '/a.ts' })).toBe('/a.ts');
    expect(extractCommand({ pattern: 'foo' })).toBe('foo');
    expect(extractCommand({ url: 'https://x' })).toBe('https://x');
    expect(extractCommand({ query: 'q' })).toBe('q');
    expect(extractCommand({ description: 'd' })).toBe('d');
  });
  it('skips empty strings to reach the next key', () => {
    expect(extractCommand({ command: '', file_path: '/a.ts' })).toBe('/a.ts');
  });
  it('ignores non-string values', () => {
    expect(extractCommand({ command: 42, pattern: 'p' })).toBe('p');
  });
  it('returns empty for non-objects or no matching key', () => {
    expect(extractCommand(null)).toBe('');
    expect(extractCommand('str')).toBe('');
    expect(extractCommand({ other: 'x' })).toBe('');
  });
});

describe('labelOf', () => {
  it('enriches subagent label with subagent_type', () => {
    expect(labelOf('Agent', { description: 'd', subagent_type: 'Explore' })).toBe('Agent · Explore');
    expect(labelOf('Task', { subagent_type: 'general-purpose' })).toBe('Task · general-purpose');
  });
  it('keeps the plain name for other tools or missing type', () => {
    expect(labelOf('Agent', { description: 'd' })).toBe('Agent');
    expect(labelOf('Bash', { command: 'ls' })).toBe('Bash');
    expect(labelOf('Read', null)).toBe('Read');
  });
  it('falls back to "tool" without a name', () => {
    expect(labelOf(undefined, {})).toBe('tool');
    expect(labelOf('', {})).toBe('tool');
  });
});

describe('commandOf', () => {
  it('TaskCreate shows the subject', () => {
    expect(commandOf('TaskCreate', { subject: 'Corrigir fila', description: 'longa' })).toBe('Corrigir fila');
  });
  it('TaskUpdate shows id, status and subject when present', () => {
    expect(commandOf('TaskUpdate', { taskId: '227', status: 'completed' })).toBe('#227 → completed');
    expect(commandOf('TaskUpdate', { taskId: 3, status: 'in_progress', subject: 'Novo título' })).toBe('#3 → in_progress · Novo título');
    expect(commandOf('TaskUpdate', { taskId: '8' })).toBe('#8');
  });
  it('falls back to extractCommand for other tools', () => {
    expect(commandOf('Bash', { command: 'ls' })).toBe('ls');
    expect(commandOf('Agent', { description: 'Revisar PR', subagent_type: 'Explore' })).toBe('Revisar PR');
    expect(commandOf('TaskUpdate', null)).toBe('');
  });
});

describe('capOutput', () => {
  it('passes small outputs through untouched', () => {
    expect(capOutput(['a', 'b'])).toEqual(['a', 'b']);
  });

  it('truncates at the cap and appends the marker', () => {
    const out = capOutput(['x'.repeat(TOOL_OUTPUT_CAP), 'overflow']);
    expect(out[out.length - 1]).toContain('truncada');
  });
});
