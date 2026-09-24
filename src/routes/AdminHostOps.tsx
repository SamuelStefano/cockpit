import { useEffect, useState } from 'react';
import { Button, Icon, Input, tokens as ui } from '../components/primitives';
import type { AdminHealth } from '../../shared/protocol';
import { AdminConfirm } from './AdminConfirm';
import { validEnvName } from '../../shared/env-name';

// Controle de escrita do host no painel admin (#162, DR-023): tokens de ambiente,
// MCPs e instalação de CLI. Só role admin chega aqui (o agente nega via authorize);
// instalação de CLI exige loopback (o agente recusa fora dele). Valor de token
// NUNCA volta — a lista mostra só os nomes (de health.envTokens).

interface AdminHostOpsProps {
  health: AdminHealth | null;
  adminOp: { ok: boolean; message: string } | null;
  onEnvSet: (name: string, value: string) => boolean;
  onEnvUnset: (name: string) => void;
  onMcpAdd: (name: string, opts: { command?: string; url?: string }) => void;
  onMcpRemove: (name: string) => void;
  onCliInstall: (name: string) => void;
}

export function AdminHostOps({ health, adminOp, onEnvSet, onEnvUnset, onMcpAdd, onMcpRemove, onCliInstall }: AdminHostOpsProps) {
  const [envName, setEnvName] = useState('');
  const [envValue, setEnvValue] = useState('');
  const [mcpName, setMcpName] = useState('');
  const [mcpTarget, setMcpTarget] = useState('');
  const [pending, setPending] = useState<{ kind: 'env' | 'mcp'; name: string } | null>(null);
  // Saving over an existing token or MCP asks first: the old token value can never
  // be read back, so a silent overwrite is unrecoverable.
  const [replacing, setReplacing] = useState<{ kind: 'env' | 'mcp'; name: string; run: () => void } | null>(null);
  const [installing, setInstalling] = useState<string | null>(null);

  // Instalar CLI demora (npm install -g); sem isto o botão aceitava double-click
  // e disparava 2 instalações. O backend sempre responde com adminOp (ok ou erro),
  // então a chegada de qualquer resultado rearma o botão.
  // Only a result releases it (see useDeckUpdate): the auto-reset to null is not one.
  useEffect(() => { if (adminOp) setInstalling(null); }, [adminOp]);

  // Backstop: se o WS cair no meio do npm install, o admin-op nunca chega e os
  // botões ficariam presos em loading. 3min cobre a instalação mais lenta.
  useEffect(() => {
    if (!installing) return;
    const t = setTimeout(() => setInstalling(null), 180_000);
    return () => clearTimeout(t);
  }, [installing]);

  const runPending = () => {
    if (!pending) return;
    if (pending.kind === 'env') onEnvUnset(pending.name);
    else onMcpRemove(pending.name);
    setPending(null);
  };

  const envNameBad = envName.trim() !== '' && !validEnvName(envName.trim());
  const addEnv = () => {
    const name = envName.trim();
    if (!name || !envValue || !validEnvName(name)) return;
    // A dropped send (socket down) keeps the secret in the field to retry.
    const run = () => { if (onEnvSet(name, envValue)) { setEnvName(''); setEnvValue(''); } };
    if ((health?.envTokens ?? []).includes(name)) setReplacing({ kind: 'env', name, run });
    else run();
  };
  const addMcp = () => {
    const name = mcpName.trim();
    const t = mcpTarget.trim();
    if (!name || !t) return;
    // A URL is http(s)://…; a command merely starting with "http" (httpie-mcp) is not.
    const run = () => { onMcpAdd(name, /^https?:\/\//.test(t) ? { url: t } : { command: t }); setMcpName(''); setMcpTarget(''); };
    if ((health?.mcp ?? []).some((m) => m.name === name)) setReplacing({ kind: 'mcp', name, run });
    else run();
  };

  const tokens = health?.envTokens ?? [];
  const mcps = health?.mcp ?? [];
  const installable = health?.installable ?? [];
  const present = new Set((health?.clis ?? []).filter((c) => c.present).map((c) => c.name));

  return (
    <div className="mb-5 rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 hairline">
      <h2 className="mb-3 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-neutral-400">
        <Icon name="zap" size={12} /> Controle do host
      </h2>

      <h3 className="mb-1.5 text-[11px] uppercase tracking-wider text-neutral-500">Tokens de ambiente</h3>
      <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input size="sm" className="min-w-0 flex-1" placeholder="NOME" aria-label="Nome do token de ambiente" aria-invalid={envNameBad} error={envNameBad} value={envName} onChange={(e) => setEnvName(e.target.value)} />
        <Input size="sm" className="min-w-0 flex-1" type="password" placeholder="valor (não volta)" aria-label="Valor do token de ambiente" value={envValue} onChange={(e) => setEnvValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && addEnv()} />
        <Button variant="secondary" size="sm" onClick={addEnv} disabled={!envName.trim() || !envValue || envNameBad}>Salvar</Button>
      </div>
      {envNameBad && <p role="alert" className="-mt-1 mb-2 text-[11px] text-red-300">Nome inválido: só letras, números e _, sem começar por número (ex: GITHUB_TOKEN).</p>}
      {tokens.length > 0 && (
        <ul className="mb-3 flex flex-wrap gap-1.5">
          {tokens.map((t) => (
            <li key={t} className="flex items-center gap-1 rounded-md border border-neutral-800 bg-neutral-900/60 px-2 py-0.5 text-[11px] text-neutral-300">
              {t}
              <button onClick={() => setPending({ kind: 'env', name: t })} title={`Remover ${t}`} aria-label={`Remover token ${t}`} className={`text-neutral-600 hover:text-red-300 ${ui.touchBox}`}><Icon name="x" size={11} /></button>
            </li>
          ))}
        </ul>
      )}

      <h3 className="mb-1.5 mt-2 text-[11px] uppercase tracking-wider text-neutral-500">Servidores MCP</h3>
      <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input size="sm" className="min-w-0 flex-1" placeholder="nome" aria-label="Nome do servidor MCP" value={mcpName} onChange={(e) => setMcpName(e.target.value)} />
        <Input size="sm" className="min-w-0 flex-1" placeholder="url http(s) ou comando stdio" aria-label="URL ou comando do servidor MCP" value={mcpTarget} onChange={(e) => setMcpTarget(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && addMcp()} />
        <Button variant="secondary" size="sm" onClick={addMcp} disabled={!mcpName.trim() || !mcpTarget.trim()}>Adicionar</Button>
      </div>
      {mcps.length > 0 && (
        <ul className="mb-3 flex flex-wrap gap-1.5">
          {mcps.map((m) => (
            <li key={m.name} className="flex items-center gap-1 rounded-md border border-neutral-800 bg-neutral-900/60 px-2 py-0.5 text-[11px] text-neutral-300">
              {m.name} <span className="text-neutral-600">{m.transport}</span>
              <button onClick={() => setPending({ kind: 'mcp', name: m.name })} title={`Remover ${m.name}`} aria-label={`Remover MCP ${m.name}`} className={`text-neutral-600 hover:text-red-300 ${ui.touchBox}`}><Icon name="x" size={11} /></button>
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
                onClick={() => { setInstalling(name); onCliInstall(name); }}
                disabled={present.has(name) || installing !== null}
                loading={installing === name}
              >
                {name}
              </Button>
            ))}
          </div>
        </>
      )}

      {replacing && (
        <AdminConfirm
          heading={replacing.kind === 'env' ? 'Substituir token?' : 'Substituir MCP?'}
          icon="alertTriangle"
          tone="accent"
          cta="Substituir"
          body={replacing.kind === 'env'
            ? <>O token <span className="font-mono text-neutral-200">{replacing.name}</span> já existe. O valor atual não pode ser recuperado depois.</>
            : <>Já existe um servidor MCP <span className="font-mono text-neutral-200">{replacing.name}</span>. A definição atual será trocada.</>}
          onConfirm={() => { replacing.run(); setReplacing(null); }}
          onCancel={() => setReplacing(null)}
        />
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
