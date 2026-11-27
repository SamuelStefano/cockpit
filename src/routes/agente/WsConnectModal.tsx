import { useEffect, useState } from 'react';
import type { AgentHistoryApi } from '../../cockpit/useAgentHistory';
import { Button, Modal } from '../../components/primitives';

interface WsConnectModalProps { open: boolean; onClose: () => void; api: AgentHistoryApi }

export function WsConnectModal({ open, onClose, api }: WsConnectModalProps) {
  const { onWsReposGet, wsRepos } = api;
  const [repo, setRepo] = useState('');
  useEffect(() => { if (open) onWsReposGet(); }, [open, onWsReposGet]);
  const choice = repo || wsRepos?.[0] || '';
  const footer = (
    <>
      <Button variant="ghost" onClick={onClose}>Agora não</Button>
      <Button disabled={!choice} onClick={() => { api.onWsConnect(choice); onClose(); }}>Conectar e fazer o primeiro commit</Button>
    </>
  );
  return (
    <Modal open={open} onClose={onClose} title="Versionar agentes no GitHub" icon="gitPullRequest" footer={footer}>
      <div className="flex flex-col gap-4 text-[13px] text-neutral-300">
        <p className="text-neutral-400">Cada agente vira uma pasta no seu repositório. Salvou no Deck, vira commit. Commitou no repo, aparece no Deck.</p>
        <label className="flex flex-col gap-1.5">
          <span className="text-neutral-200">Repositório</span>
          <select value={choice} onChange={(e) => setRepo(e.target.value)} disabled={!wsRepos?.length}
            className="rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-neutral-100">
            {(wsRepos ?? []).map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <small className="text-neutral-500">
            {wsRepos === null ? 'Carregando…' : wsRepos.length ? 'Repositórios que o app do GitHub pode acessar.' : 'Crie o repositório deck-agents (privado) e dê acesso ao app do GitHub do Deck.'}
          </small>
        </label>
        <div>
          <span className="text-neutral-200">Estrutura</span>
          <p className="text-neutral-500">Um repositório por usuário, uma pasta por agente.</p>
          <pre className="mt-1 rounded-md border border-neutral-800 bg-neutral-950 p-2 font-mono text-[12px] text-neutral-400">{'deck-agents/\n  <agente>/\n    CLAUDE.md\n    .claude/settings.json\n    skills/…'}</pre>
        </div>
      </div>
    </Modal>
  );
}
