import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createRequest, popPending, markReady, markClosed, listTunnels, getTunnel,
  parseRelayCommand, pollOnce, purgeExpired, PORT_MIN, PORT_MAX,
} from './tunnel';

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'deck-tunnel-')); process.env.DECK_TUNNEL_DIR = dir; });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); delete process.env.DECK_TUNNEL_DIR; });

describe('fila de túneis', () => {
  it('createRequest grava pending com porta do serviço', () => {
    const t = createRequest('obsidian');
    expect(t.status).toBe('pending');
    expect(t.service).toBe('obsidian');
    expect(t.remotePort).toBe(27123);
    expect(getTunnel(t.id)?.status).toBe('pending');
  });

  it('rejeita serviço desconhecido', () => {
    expect(() => createRequest('nope')).toThrow(/desconhecido/);
  });

  it('clampa o TTL ao máximo', () => {
    expect(createRequest('obsidian', { ttlSec: 999_999 }).ttlSec).toBe(3600);
    expect(createRequest('obsidian', { ttlSec: 0 }).ttlSec).toBe(1);
  });

  it('atribui portas distintas quando a preferida está ocupada', () => {
    const a = createRequest('obsidian');
    const b = createRequest('obsidian');
    expect(a.remotePort).toBe(27123);
    expect(b.remotePort).not.toBe(27123);
    expect(b.remotePort).toBeGreaterThanOrEqual(PORT_MIN);
    expect(b.remotePort).toBeLessThanOrEqual(PORT_MAX);
  });

  it('pop marca claimed e não reentrega', () => {
    createRequest('obsidian');
    expect(popPending().map(t => t.status)).toEqual(['claimed']);
    expect(popPending()).toEqual([]);
  });

  it('markReady deixa pollOnce pronto e define expiração', () => {
    const t = createRequest('obsidian', { ttlSec: 600 });
    popPending();
    const ready = markReady(t.id, t.remotePort);
    expect(ready.status).toBe('ready');
    expect(ready.expiresAt).toBeGreaterThan(ready.readyAt!);
    const r = pollOnce(t.id);
    expect(r.done).toBe(true);
  });

  it('pollOnce reporta fechado', () => {
    const t = createRequest('obsidian');
    markClosed(t.id);
    expect(pollOnce(t.id)).toEqual({ done: false, reason: 'fechado' });
  });

  it('purgeExpired marca ready vencido como expired e some da lista', () => {
    const t = createRequest('obsidian', { ttlSec: 1 });
    markReady(t.id);
    purgeExpired(Date.now() + 2000);
    expect(getTunnel(t.id)?.status).toBe('expired');
    expect(listTunnels()).toEqual([]);
  });
});

describe('parseRelayCommand (fronteira do desktop)', () => {
  it('aceita só os verbos permitidos', () => {
    expect(parseRelayCommand('pop')).toEqual({ kind: 'pop' });
    expect(parseRelayCommand('list')).toEqual({ kind: 'list' });
    expect(parseRelayCommand('ready abc 27123')).toEqual({ kind: 'ready', id: 'abc', port: 27123 });
    expect(parseRelayCommand('ready abc')).toEqual({ kind: 'ready', id: 'abc', port: undefined });
  });

  it('vazio vira hold (conexão de dados -N -R)', () => {
    expect(parseRelayCommand('')).toEqual({ kind: 'hold', sec: 3600 });
    expect(parseRelayCommand(undefined)).toEqual({ kind: 'hold', sec: 3600 });
  });

  it('recusa porta fora do range e verbos arbitrários', () => {
    expect(parseRelayCommand('ready abc 80').kind).toBe('reject');
    expect(parseRelayCommand('rm -rf /').kind).toBe('reject');
    expect(parseRelayCommand('request obsidian').kind).toBe('reject');
  });

  it('ready sem id é recusado', () => {
    expect(parseRelayCommand('ready')).toEqual({ kind: 'reject', reason: 'ready exige <id>' });
  });
});
