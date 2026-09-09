import { describe, it, expect } from 'vitest';
import { createMcpLimiter, isHeavyTool } from './limit';

describe('isHeavyTool', () => {
  // O critério é o TRABALHO, não a origem: espelha o balde HEAVY do WS (grep,
  // varredura do diretório de sessões, parse de transcript inteiro).
  it('marca só o que faz grep/scan/parse pesado', () => {
    expect(isHeavyTool('sessions_search')).toBe(true);
    expect(isHeavyTool('sessions_read')).toBe(true);
    expect(isHeavyTool('sessions_list')).toBe(true);
    expect(isHeavyTool('contexts_read')).toBe(false);
    expect(isHeavyTool('skills_list')).toBe(false);
  });
});

describe('createMcpLimiter', () => {
  // Relógio injetado: sem isso o teste dependeria de dormir de verdade.
  function clock(start = 0) {
    let t = start;
    return { now: () => t, advance: (ms: number) => { t += ms; } };
  }

  it('corta a rajada de requisições no burst global', () => {
    const c = clock();
    const l = createMcpLimiter(c.now);
    let ok = 0;
    for (let i = 0; i < 200; i++) if (l.allowRequest()) ok++;
    expect(ok).toBe(60);
    expect(l.allowRequest()).toBe(false);
  });

  it('reabastece com o tempo', () => {
    const c = clock();
    const l = createMcpLimiter(c.now);
    while (l.allowRequest()) { /* esvazia */ }
    c.advance(1000);
    expect(l.allowRequest()).toBe(true);
  });

  // Era o furo: o mesmo grep que o WS limita a 15 de burst passava ilimitado pela
  // rota HTTP, que ainda por cima é alcançável de fora da box.
  it('segura a tool cara num balde próprio, mais apertado que o global', () => {
    const c = clock();
    const l = createMcpLimiter(c.now);
    let ok = 0;
    for (let i = 0; i < 100; i++) if (l.allowTool('sessions_search')) ok++;
    expect(ok).toBe(15);
  });

  it('tool barata não gasta o balde caro', () => {
    const c = clock();
    const l = createMcpLimiter(c.now);
    for (let i = 0; i < 100; i++) expect(l.allowTool('contexts_read')).toBe(true);
    expect(l.allowTool('sessions_search')).toBe(true);
  });
});
