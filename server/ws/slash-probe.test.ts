import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';

// `claude` é um binário REAL na máquina do Samuel: sem este mock a sonda subiria um
// processo de verdade e queimaria token a cada rodada de teste.
const spawned = vi.hoisted(() => ({
  calls: [] as { cmd: string; args: string[]; opts: Record<string, unknown> }[],
  child: null as FakeChild | null,
  throws: false,
}));
vi.mock('node:child_process', () => ({
  spawn: (cmd: string, args: string[], opts: Record<string, unknown>) => {
    spawned.calls.push({ cmd, args, opts });
    if (spawned.throws) throw new Error('EACCES');
    return spawned.child;
  },
}));

const killed = vi.hoisted(() => ({ pids: [] as number[] }));
vi.mock('../config', () => ({ CONFIG: { workdir: '/tmp/deck-probe' } }));

const applied = vi.hoisted(() => ({ lists: [] as string[][] }));
vi.mock('./slash', () => ({ applySlashCommands: (sc: string[]) => applied.lists.push(sc) }));

class FakeChild extends EventEmitter {
  pid = 4242;
  stdout = new PassThrough();
  stderr = new PassThrough();
  kill = vi.fn();
}

const { probeSlashCommands } = await import('./slash-probe');

beforeEach(() => {
  spawned.calls = [];
  applied.lists = [];
  killed.pids = [];
  spawned.child = new FakeChild();
  spawned.throws = false;
  vi.spyOn(process, 'kill').mockImplementation(((pid: number) => { killed.pids.push(pid); return true; }) as typeof process.kill);
});

const flush = () => new Promise((r) => setImmediate(r));

describe('sonda de slash-commands', () => {
  it('sobe o CLI com env mínimo e permission-mode plan', () => {
    probeSlashCommands();
    const [call] = spawned.calls;
    expect(call.cmd).toBe('claude');
    expect(call.args).toContain('--permission-mode');
    expect(call.args).toContain('plan');
    expect(call.args).toContain('stream-json');
    // env herdado inteiro vazaria segredo do backend para um spawn que só lê 1 linha.
    expect(Object.keys(call.opts.env as object).sort()).toEqual(['HOME', 'LANG', 'PATH', 'TERM']);
    expect(call.opts.shell).toBe(false);
  });

  it('extrai slash_commands do system event e mata o grupo na hora', async () => {
    probeSlashCommands();
    spawned.child!.stdout.write(`${JSON.stringify({ type: 'system', slash_commands: ['compact', 'review'] })}\n`);
    await flush();
    expect(applied.lists).toEqual([['compact', 'review']]);
    // grupo inteiro (-pid): o CLI subiu detached e deixaria filhos vivos.
    expect(killed.pids).toEqual([-4242]);
  });

  it('descarta entradas que não são string', async () => {
    probeSlashCommands();
    spawned.child!.stdout.write(`${JSON.stringify({ type: 'system', slash_commands: ['ok', 7, null] })}\n`);
    await flush();
    expect(applied.lists).toEqual([['ok']]);
  });

  it('ignora linha não-JSON, linha vazia e evento de outro tipo', async () => {
    probeSlashCommands();
    spawned.child!.stdout.write('não é json\n\n');
    spawned.child!.stdout.write(`${JSON.stringify({ type: 'assistant' })}\n`);
    spawned.child!.stdout.write(`${JSON.stringify({ type: 'system', slash_commands: [] })}\n`);
    await flush();
    expect(applied.lists).toEqual([]);
    expect(killed.pids).toEqual([]);
  });

  it('mata só uma vez, mesmo com mais eventos depois do primeiro', async () => {
    probeSlashCommands();
    spawned.child!.stdout.write(`${JSON.stringify({ type: 'system', slash_commands: ['a'] })}\n`);
    spawned.child!.stdout.write(`${JSON.stringify({ type: 'system', slash_commands: ['b'] })}\n`);
    await flush();
    expect(killed.pids).toEqual([-4242]);
  });

  it('não estoura quando o spawn falha na hora (claude fora do PATH, EACCES)', () => {
    spawned.throws = true;
    expect(() => probeSlashCommands()).not.toThrow();
    expect(applied.lists).toEqual([]);
  });
});

// O backstop do index.ts chama shutdown(1) em uncaughtException: um erro de stream
// não tratado aqui derrubaria o backend INTEIRO por causa de uma sonda opcional.
describe('sonda: erro de stream não pode derrubar o backend', () => {
  // Handler no stream NÃO basta: o readline reemite o erro do input na própria
  // Interface, e 'error' sem listener num EventEmitter volta a ser throw.
  it('absorve erro do stdout sem deixar nada propagar', async () => {
    probeSlashCommands();
    expect(spawned.child!.stdout.listenerCount('error')).toBeGreaterThan(0);
    expect(() => spawned.child!.stdout.emit('error', new Error('EPIPE'))).not.toThrow();
    await flush();
    expect(killed.pids).toEqual([-4242]);
  });

  it('trata erro no stderr', async () => {
    probeSlashCommands();
    expect(spawned.child!.stderr.listenerCount('error')).toBeGreaterThan(0);
    expect(() => spawned.child!.stderr.emit('error', new Error('ECONNRESET'))).not.toThrow();
  });

  // Pipe não lido enche em ~64KB e trava o filho até o timeout de 30s.
  it('drena o stderr em vez de deixar o pipe encher', async () => {
    probeSlashCommands();
    spawned.child!.stderr.write('x'.repeat(200_000));
    await flush();
    expect(spawned.child!.stderr.readableLength).toBe(0);
  });

  it('trata erro do próprio processo', () => {
    probeSlashCommands();
    expect(() => spawned.child!.emit('error', new Error('ENOENT'))).not.toThrow();
  });
});
