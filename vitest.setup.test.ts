import { describe, it, expect } from 'vitest';
import { tmpdir } from 'node:os';

// O setup é o que impede a suíte de depender da máquina de quem roda. Se ele parar
// de ser aplicado (config mexida, arquivo renomeado), estes testes avisam antes de
// alguém redescobrir o problema subindo fixture em storage compartilhado de novo.

describe('isolamento do ambiente de teste', () => {
  it('roda sob um HOME descartável, não o do dev', () => {
    expect(process.env.HOME?.startsWith(tmpdir())).toBe(true);
  });

  it('não enxerga a credencial de upload, mesmo exportada no shell', () => {
    expect(process.env.DECK_S3_ANON_KEY).toBeUndefined();
  });

  it('bloqueia fetch pra fora, apontando a saída', async () => {
    await expect(fetch('https://example.com/x')).rejects.toThrow(/rede externa bloqueada/);
  });

  it('deixa passar loopback (o relay sobe servidor de verdade em 127.0.0.1)', async () => {
    // Ninguém escutando: o erro tem que ser de conexão recusada, não do bloqueio.
    await expect(fetch('http://127.0.0.1:1/x')).rejects.not.toThrow(/rede externa bloqueada/);
  });
});
