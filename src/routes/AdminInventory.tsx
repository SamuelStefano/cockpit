import type { AdminHealth } from '../../shared/protocol';
import { Dot, Chip, Inv } from './adminPrimitives';

// Inventário read-only do host (vínculos + grids de CLIs/MCP/SSH/tmux/plugins/tokens).
// Extraído do Admin.tsx pra manter a rota enxuta e o organismo reutilizável.
export function AdminInventory({ health }: { health: AdminHealth }) {
  return (
    <>
      <div className="mb-5 rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 hairline">
        <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-neutral-400">Vínculos</h2>
        <ul className="space-y-2 text-[13px]">
          <li className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-neutral-300"><Dot on={health.claudeAuth} /> Conta Claude (CLI)</span>
            <span className="text-neutral-500">{health.claudeAuth ? 'autenticado' : 'sem credencial'}</span>
          </li>
          <li className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-neutral-300"><Dot on={health.mcpServers.length > 0} /> Servidores MCP</span>
            {/* No mobile a lista inteira truncava ("dfl-payment…") — mostra só a contagem; a lista completa já está no card "Servidores MCP" abaixo. */}
            <span className="pl-3 text-right text-neutral-500">
              <span className="sm:hidden">{health.mcpServers.length || 'nenhum'}</span>
              <span className="hidden sm:inline">{health.mcpServers.length ? health.mcpServers.join(', ') : 'nenhum'}</span>
            </span>
          </li>
          <li className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-neutral-300"><Dot on={health.sshKeys > 0} /> Chaves SSH</span>
            <span className="text-neutral-500">{health.sshKeys} chave(s)</span>
          </li>
        </ul>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <Inv icon="terminal" title="CLIs no PATH" count={health.clis.filter((c) => c.present).length}>
          {health.clis.map((c) => <Chip key={c.name} label={c.name} on={c.present} />)}
        </Inv>
        <Inv icon="sparkles" title="Servidores MCP" count={health.mcp.length}>
          {health.mcp.map((m) => <Chip key={m.name} label={m.name} muted={m.transport} />)}
        </Inv>
        <Inv icon="terminal" title="Hosts SSH" count={health.sshHosts.length}>
          {health.sshHosts.map((h) => <Chip key={h} label={h} />)}
        </Inv>
        <Inv icon="message" title="Sessões tmux" count={health.tmuxSessions.length}>
          {health.tmuxSessions.map((s) => <Chip key={s} label={s} />)}
        </Inv>
        <Inv icon="sparkles" title="Plugins instalados" count={health.plugins.length}>
          {health.plugins.map((p) => <Chip key={`${p.name}@${p.marketplace}`} label={p.name} muted={p.version ? `v${p.version}` : undefined} />)}
        </Inv>
        <div className="sm:col-span-2">
          <Inv icon="zap" title="Tokens no ambiente (só nomes)" count={health.envTokens.length}>
            {health.envTokens.map((t) => <Chip key={t} label={t} />)}
          </Inv>
        </div>
      </div>
    </>
  );
}
