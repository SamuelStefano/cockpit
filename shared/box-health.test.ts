import { describe, it, expect } from 'vitest';
import {
  evalAgentVersion, evalClaudeCli, evalClaudeAuth, evalNode, evalPty, evalDisk, evalDevices, evalSelfUpdate,
  overallLevel, smokeHint, parseHealth, parseSmoke, missingFlags, REQUIRED_CLI_FLAGS, BOT_CLI_FLAGS,
} from './box-health';

const FULL_HELP = [...REQUIRED_CLI_FLAGS, ...BOT_CLI_FLAGS].join('\n');

describe('evalClaudeCli', () => {
  it('errors when claude is missing from PATH', () => {
    const r = evalClaudeCli({ path: '', version: '', help: '' });
    expect(r.level).toBe('error');
    expect(r.hint).toMatch(/npm install -g @anthropic-ai\/claude-code/);
  });

  it('errors when the CLI does not answer --version', () => {
    expect(evalClaudeCli({ path: '~/.local/bin/claude', version: '', help: '' }).level).toBe('error');
  });

  it('errors on a CLI that lacks a flag every turn passes', () => {
    const help = FULL_HELP.replace('--effort', '');
    const r = evalClaudeCli({ path: '/usr/bin/claude', version: '1.0.3', help });
    expect(r.level).toBe('error');
    expect(r.detail).toContain('--effort');
  });

  it('warns when only the bot flags are missing', () => {
    const r = evalClaudeCli({ path: '/usr/bin/claude', version: '2.0.0', help: REQUIRED_CLI_FLAGS.join(' ') });
    expect(r.level).toBe('warn');
    expect(r.detail).toContain('--restricted');
  });

  it('is ok with every flag present', () => {
    expect(evalClaudeCli({ path: '/usr/bin/claude', version: '2.1.311', help: FULL_HELP }).level).toBe('ok');
  });

  it('only warns when --help did not answer', () => {
    expect(evalClaudeCli({ path: '/usr/bin/claude', version: '2.1.311', help: '' }).level).toBe('warn');
  });
});

describe('missingFlags', () => {
  it('lists the absent flags in order', () => {
    expect(missingFlags('--a --c', ['--a', '--b', '--c', '--d'])).toEqual(['--b', '--d']);
  });
});

describe('evalAgentVersion', () => {
  it('is ok and in sync', () => {
    expect(evalAgentVersion({ head: 'abc1234', boot: 'abc1234', behind: 0 })).toMatchObject({ level: 'ok', detail: 'abc1234 · em dia com a main' });
  });
  it('warns when behind main', () => {
    expect(evalAgentVersion({ head: 'abc1234', boot: 'abc1234', behind: 3 }).level).toBe('warn');
  });
  it('warns when the disk moved past the running code', () => {
    const r = evalAgentVersion({ head: 'def5678', boot: 'abc1234', behind: 0 });
    expect(r.level).toBe('warn');
    expect(r.hint).toContain('systemctl restart deck-agent');
  });
  it('is ok when behind is unknown', () => {
    expect(evalAgentVersion({ head: 'abc1234', boot: 'abc1234', behind: null }).level).toBe('ok');
  });
  it('warns without git', () => {
    expect(evalAgentVersion({ head: '', boot: '', behind: null }).level).toBe('warn');
  });
});

describe('evalClaudeAuth', () => {
  it('errors when not logged in', () => expect(evalClaudeAuth({ ready: false, held: false }).level).toBe('error'));
  it('errors when the login expired', () => expect(evalClaudeAuth({ ready: true, held: true }).level).toBe('error'));
  it('is ok when logged in', () => expect(evalClaudeAuth({ ready: true, held: false }).level).toBe('ok'));
});

describe('evalNode', () => {
  it('errors below the minimum', () => expect(evalNode('v18.19.0').level).toBe('error'));
  it('errors on Node 20: the claude CLI needs 22', () => {
    const r = evalNode('v20.20.2');
    expect(r.level).toBe('error');
    expect(r.hint).toMatch(/Node 22/);
  });
  it('is ok from 22 up', () => expect(evalNode('v22.22.2').level).toBe('ok'));
  it('warns on garbage', () => expect(evalNode('').level).toBe('warn'));
});

describe('evalPty', () => {
  it('warns and keeps a short error', () => {
    const r = evalPty({ ok: false, error: 'x'.repeat(500) });
    expect(r.level).toBe('warn');
    expect(r.detail.length).toBeLessThan(150);
  });
  it('is ok when it loads', () => expect(evalPty({ ok: true, error: '' }).level).toBe('ok'));
});

describe('evalDisk', () => {
  const GB = 1024 ** 3;
  it('errors below 1 GB', () => expect(evalDisk(0.5 * GB).level).toBe('error'));
  it('warns below 5 GB', () => expect(evalDisk(3 * GB).level).toBe('warn'));
  it('is ok with room', () => expect(evalDisk(40 * GB)).toMatchObject({ level: 'ok', detail: '40.0 GB livres' }));
  it('warns when unknown', () => expect(evalDisk(null).level).toBe('warn'));
});

describe('evalDevices', () => {
  it('warns with none', () => expect(evalDevices(0).level).toBe('warn'));
  it('warns when unreadable', () => expect(evalDevices(null).level).toBe('warn'));
  it('is ok with some', () => expect(evalDevices(2)).toMatchObject({ level: 'ok', detail: '2' }));
});

describe('evalSelfUpdate', () => {
  it('is ok before the first check', () => expect(evalSelfUpdate({ result: null, reason: '' }).level).toBe('ok'));
  it('warns without a supervisor', () => {
    expect(evalSelfUpdate({ result: 'skipped', reason: 'no supervisor to restart the agent' }).level).toBe('warn');
  });
  it('is ok when skipped on a dev clone', () => {
    expect(evalSelfUpdate({ result: 'skipped', reason: 'on branch feat/x, not main' }).level).toBe('ok');
  });
  it('warns when the fetch fails', () => expect(evalSelfUpdate({ result: 'fetch-failed', reason: '' }).level).toBe('warn'));
  it('warns on an unknown result', () => expect(evalSelfUpdate({ result: 'weird', reason: '' }).level).toBe('warn'));
});

describe('overallLevel', () => {
  it('takes the worst item', () => {
    expect(overallLevel([{ level: 'ok' }, { level: 'warn' }])).toBe('warn');
    expect(overallLevel([{ level: 'warn' }, { level: 'error' }, { level: 'ok' }])).toBe('error');
    expect(overallLevel([])).toBe('ok');
  });
});

describe('smokeHint', () => {
  it('maps an old CLI', () => expect(smokeHint("claude saiu (1): error: unknown option '--effort'")).toMatch(/antigo demais/));
  it('maps a missing binary', () => expect(smokeHint('spawn claude ENOENT')).toMatch(/não acha o `claude`/));
  it('maps an expired login', () => expect(smokeHint('OAuth session expired and could not be refreshed')).toMatch(/login/));
  it('maps a model that does not exist before the generic not-found', () => {
    expect(smokeHint('model claude-haiku-9 not found')).toMatch(/modelo/);
  });
  it('maps a permission error', () => expect(smokeHint("EACCES: permission denied, open '/home/deck/.claude.lock'")).toMatch(/Permissão/));
  it('falls back to the agent log', () => expect(smokeHint('something odd')).toMatch(/journalctl/));
});

describe('parseHealth', () => {
  it('drops items with unknown ids or levels and caps strings', () => {
    const h = parseHealth({
      at: 5,
      items: [
        { id: 'disk', label: 'Disco', level: 'ok', detail: 'x'.repeat(500) },
        { id: 'evil', label: 'x', level: 'ok', detail: '' },
        { id: 'node', label: 'Node', level: 'panic', detail: '' },
        { id: 'pty', label: 'pty', level: 'warn', detail: 'd', hint: 'h' },
      ],
    });
    expect(h?.at).toBe(5);
    expect(h?.items.map((i) => i.id)).toEqual(['disk', 'pty']);
    expect(h?.items[0].detail.length).toBe(200);
    expect(h?.items[1].hint).toBe('h');
  });
  it('rejects non-objects', () => {
    expect(parseHealth(null)).toBeNull();
    expect(parseHealth({ items: 'x' })).toBeNull();
  });
});

describe('parseSmoke', () => {
  it('keeps known fields', () => {
    expect(parseSmoke({ state: 'done', ok: false, ms: 10, error: 'e', hint: 'h' })).toEqual({ state: 'done', ok: false, ms: 10, error: 'e', hint: 'h' });
  });
  it('rejects unknown states', () => expect(parseSmoke({ state: 'x' })).toBeNull());
});
