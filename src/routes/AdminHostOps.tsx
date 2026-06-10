import { useState } from 'react';
import { Button, Icon } from '../components/primitives';
import type { AdminHealth } from '../../shared/protocol';
import { AdminConfirm } from './AdminConfirm';

// Controle de escrita do host no painel admin (#162, DR-023): tokens de ambiente,
// MCPs e instalação de CLI. Só role admin chega aqui (o agente nega via authorize);
// instalação de CLI exige loopback (o agente recusa fora dele). Valor de token
// NUNCA volta — a lista mostra só os nomes (de health.envTokens).

interface AdminHostOpsProps {
  health: AdminHealth | null;
  adminOp: { ok: boolean; message: string } | null;
  onEnvSet: (name: string, value: string) => void;
  onEnvUnset: (name: string) => void;
  onMcpAdd: (name: string, opts: { command?: string; url?: string }) => void;
  onMcpRemove: (name: string) => void;
  onCliInstall: (name: string) => void;
}

const inputCls = 'min-w-0 flex-1 rounded-md border border-neutral-800 bg-neutral-950 px-2.5 py-1.5 text-[12.5px] text-neutral-200 placeholder:text-neutral-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40';

export function AdminHostOps({ health, adminOp, onEnvSet, onEnvUnset, onMcpAdd, onMcpRemove, onCliInstall }: AdminHostOpsProps) {
  const [envName, setEnvName] = useState('');
  const [envValue, setEnvValue] = useState('');
  const [mcpName, setMcpName] = useState('');
  const [mcpTarget, setMcpTarget] = useState('');
  const [pending, setPending] = useState<{ kind: 'env' | 'mcp'; name: string } | null>(null);

  const runPending = () => {
    if (!pending) return;
    if (pending.kind === 'env') onEnvUnset(pending.name);
    else onMcpRemove(pending.name);
    setPending(null);
  };

  const addEnv = () => {
    if (!envName.trim() || !envValue) return;
    onEnvSet(envName.trim(), envValue);
    setEnvName(''); setEnvValue('');
  };
  const addMcp = () => {
    const t = mcpTarget.trim();
    if (!mcpName.trim() || !t) return;
    onMcpAdd(mcpName.trim(), t.startsWith('http') ? { url: t } : { command: t });
    setMcpName(''); setMcpTarget('');
  };

  const tokens = health?.envTokens ?? [];
  const mcps = health?.mcp ?? [];
  const installable = health?.installable ?? [];
  const present = new Set((health?.clis ?? []).filter((c) => c.present).map((c) => c.name));

  return (
    <div className="mb-5 rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
      <h2 className="mb-3 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-neutral-400">
        <Icon name="zap" size={12} /> Controle do host
      </h2>

      {adminOp && (
        <div className={`mb-3 rounded-md border px-2.5 py-1.5 text-[12px] ${adminOp.ok ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border-red-500/30 bg-red-500/10 text-red-200'}`}>
          {adminOp.message}
        </div>
      )}

      <h3 className="mb-1.5 text-[11px] uppercase tracking-wider text-neutral-500">Tokens de ambiente</h3>
      <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input className={inputCls} placeholder="NOME" value={envName} onChange={(e) => setEnvName(e.target.value)} />
        <input className={inputCls} type="password" placeholder="valor (não volta)" value={envValue} onChange={(e) => setEnvValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addEnv()} />
        <Button variant="secondary" size="sm" onClick={addEnv} disabled={!envName.trim() || !envValue}>Salvar</Button>
      </div>
      {tokens.length > 0 && (
        <ul className="mb-3 flex flex-wrap gap-1.5">
          {tokens.map((t) => (
            <li key={t} className="flex items-center gap-1 rounded-md border border-neutral-800 bg-neutral-900/60 px-2 py-0.5 text-[11px] text-neutral-300">
              {t}
              <button onClick={() => setPending({ kind: 'env', name: t })} title="Remover" className="text-neutral-600 hover:text-red-300"><Icon name="x" size={11} /></button>
            </li>
          ))}
        </ul>
      )}

      <h3 className="mb-1.5 mt-2 text-[11px] uppercase tracking-wider text-neutral-500">Servidores MCP</h3>
      <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input className={inputCls} placeholder="nome" value={mcpName} onChange={(e) => setMcpName(e.target.value)} />
        <input className={inputCls} placeholder="url http(s) ou comando stdio" value={mcpTarget} onChange={(e) => setMcpTarget(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addMcp()} />
        <Button variant="secondary" size="sm" onClick={addMcp} disabled={!mcpName.trim() || !mcpTarget.trim()}>Adicionar</Button>
      </div>
      {mcps.length > 0 && (
        <ul className="mb-3 flex flex-wrap gap-1.5">
          {mcps.map((m) => (
            <li key={m.name} className="flex items-center gap-1 rounded-md border border-neutral-800 bg-neutral-900/60 px-2 py-0.5 text-[11px] text-neutral-300">
              {m.name} <span className="text-neutral-600">{m.transport}</span>
              <button onClick={() => setPending({ kind: 'mcp', name: m.name })} title="Remover" className="text-neutral-600 hover:text-red-300"><Icon name="x" size={11} /></button>
            </li>
          ))}
        </ul>
      )}

      {installable.length > 0 && (
        <>
          <h3 className="mb-1.5 mt-2 text-[11px] uppercase tracking-wider text-neutral-500">Instalar CLI <span className="text-neutral-600">(só loopback)</span></h3>
          <div className="flex flex-wrap gap-1.5">
            {installable.map((name) => (
              <Button
                key={name}
                variant="secondary"
                size="sm"
                icon={present.has(name) ? 'check' : 'rotate'}
                onClick={() => onCliInstall(name)}
                disabled={present.has(name)}
              >
                {name}
              </Button>
            ))}
          </div>
        </>
      )}

      {pending && (
        <AdminConfirm
          heading={pending.kind === 'env' ? 'Remover token?' : 'Remover MCP?'}
          icon="trash"
          cta="Remover"
          body={pending.kind === 'env'
            ? <>O token <span className="font-mono text-neutral-200">{pending.name}</span> sai do ambiente do agente. Processos que dependem dele podem falhar.</>
            : <>O servidor MCP <span className="font-mono text-neutral-200">{pending.name}</span> deixa de ficar disponível para o agente.</>}
          onConfirm={runPending}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  );
}
