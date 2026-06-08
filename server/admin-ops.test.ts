import { describe, it, expect } from 'vitest';
import { setEnv, addMcp, installCli, INSTALLABLE } from './admin-ops';

// Cobre os guards que rejeitam ANTES de tocar o disco (#162): validação de nome,
// allow-list de instalação e exigência de alvo do MCP. As escritas reais (env.json,
// ~/.claude.json, npm i -g) são exercitadas ponta-a-ponta; aqui só as bordas puras.

describe('admin-ops guards', () => {
  it('rejeita nome de env inválido sem persistir', async () => {
    expect(await setEnv('bad name', 'v')).toEqual({ ok: false, message: 'nome de env inválido' });
    expect(await setEnv('1LEADING', 'v')).toEqual({ ok: false, message: 'nome de env inválido' });
    expect(await setEnv('has-dash', 'v')).toEqual({ ok: false, message: 'nome de env inválido' });
  });

  it('addMcp exige nome e alvo', async () => {
    expect(await addMcp('', {})).toEqual({ ok: false, message: 'nome do MCP vazio' });
    expect(await addMcp('foo', {})).toEqual({ ok: false, message: 'informe url ou command' });
  });

  it('installCli só aceita a allow-list', async () => {
    expect(await installCli('rm-rf-slash')).toEqual({ ok: false, message: 'rm-rf-slash não está na allow-list' });
    expect(INSTALLABLE).toContain('vercel');
    expect(INSTALLABLE).toContain('supabase');
  });
});
