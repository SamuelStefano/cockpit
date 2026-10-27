import { useCallback, useEffect, useState } from 'react';
import type { VaultApi } from '../../cockpit/useVault';

const NAME_RE = /^[A-Z_][A-Z0-9_]{0,63}$/;
const AGENT_RE = /^[a-z0-9][a-z0-9._-]{0,39}$/;
const RESERVED_RE = /^(PATH|HOME|SHELL|IFS|ENV|BASH_ENV|NODE_OPTIONS|NODE_PATH|PYTHONPATH|PYTHONSTARTUP|PERL5OPT|RUBYOPT|ANTHROPIC_API_KEY|LD_.*|DYLD_.*|CLAUDE_.*)$/;
const MAX_BYTES = 16_384;

export function parseAgents(text: string): string[] | null {
  const ids = [...new Set(text.split(/[\s,]+/).filter(Boolean))];
  return ids.every((a) => AGENT_RE.test(a)) && ids.length <= 20 ? ids : null;
}

export function useVaultForm(api: VaultApi, open: boolean) {
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const [agents, setAgents] = useState('claude');
  const [erro, setErro] = useState('');

  const { onVaultList } = api;
  useEffect(() => { if (open) onVaultList(); }, [open, onVaultList]);

  const submit = useCallback(() => {
    const key = name.trim();
    if (!NAME_RE.test(key) || RESERVED_RE.test(key)) { setErro('nome: MAIÚSCULAS, números e _ (não pode ser PATH, HOME, LD_*, CLAUDE_*…)'); return; }
    if (!value) { setErro('sem valor pra gravar'); return; }
    if (new Blob([value]).size > MAX_BYTES) { setErro('valor grande demais (máx. 16 KB)'); return; }
    const list = parseAgents(agents);
    if (!list) { setErro('agentes: ids em minúsculas separados por vírgula'); return; }
    if (!api.onVaultPut(key, value, list)) { setErro('sem conexão — nada foi gravado'); return; }
    setErro('');
    setValue('');
    setName('');
  }, [api, name, value, agents]);

  return { name, setName, value, setValue, agents, setAgents, erro, submit };
}
