import { useEffect } from 'react';
import { Button, IconButton, SectionTitle } from '../../components/primitives';
import { VpsMeters } from '../../components/chrome/sidebar/VpsMeters';
import { TopBarAction } from '../../components/chrome/sidebar/TopBarSlot';
import { AdminHostOps } from '../AdminHostOps';
import { AdminDeckUpdate } from '../AdminDeckUpdate';
import { AdminInventory } from '../AdminInventory';
import { Collapsible } from '../Collapsible';
import { ClaudeAccountCard } from './ClaudeAccountCard';
import type { AdminHealth, ClaudeAccount, ClaudeLoginView, SysStats } from '../../../shared/protocol';
import { useAdminOpToast } from './useAdminOpToast';

interface MaquinaProps {
  stats: SysStats | null;
  health: AdminHealth | null;
  onHealthList: () => void;
  isRoot: boolean;
  adminOp: { ok: boolean; message: string } | null;
  onEnvSet: (name: string, value: string) => boolean;
  onEnvUnset: (name: string) => void;
  onMcpAdd: (name: string, opts: { command?: string; url?: string }) => void;
  onMcpRemove: (name: string) => void;
  onCliInstall: (name: string) => void;
  onCliUpdate: () => void;
  onDeckRestart: (mode: 'idle' | 'now') => void;
  claudeAccount: ClaudeAccount | null;
  claudeLogin: ClaudeLoginView;
  onClaudeAccountGet: () => void;
  onClaudeLogout: () => void;
  onClaudeLoginStart: () => void;
  onClaudeLoginCode: (code: string) => void;
  onClaudeLoginCancel: () => void;
}

export function Maquina(p: MaquinaProps) {
  const { onHealthList } = p;
  useAdminOpToast(p.adminOp);
  // Health spawns probes server-side: poll only while the tab is visible.
  useEffect(() => {
    onHealthList();
    const id = setInterval(() => { if (!document.hidden) onHealthList(); }, 10_000);
    const onVisible = () => { if (!document.hidden) onHealthList(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisible); };
  }, [onHealthList]);

  return (
    <>
      <div className="flex items-center max-lg:hidden">
        <SectionTitle className="flex-1">Máquina</SectionTitle>
        <Button variant="secondary" size="sm" icon="rotate" title="Atualizar agora" onClick={onHealthList}>Atualizar</Button>
      </div>
      <TopBarAction>
        <IconButton icon="rotate" label="Atualizar agora" side="bottom" onClick={onHealthList} className="pointer-coarse:h-11 pointer-coarse:w-11" />
      </TopBarAction>
      <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/60 hairline [&>div]:border-t-0 max-lg:rounded-none max-lg:border-0 max-lg:bg-transparent [&>div]:max-lg:px-0">
        <VpsMeters stats={p.stats} />
      </div>
      {p.health && <Collapsible title="Inventário"><AdminInventory health={p.health} /></Collapsible>}
      {p.isRoot && (
        <div className="mt-6 max-lg:mt-0">
          <ClaudeAccountCard
            account={p.claudeAccount} login={p.claudeLogin} onGet={p.onClaudeAccountGet} onLogout={p.onClaudeLogout}
            onLoginStart={p.onClaudeLoginStart} onLoginCode={p.onClaudeLoginCode} onLoginCancel={p.onClaudeLoginCancel}
          />
          <AdminDeckUpdate health={p.health} adminOp={p.adminOp} onCliUpdate={p.onCliUpdate} onDeckRestart={p.onDeckRestart} />
          <AdminHostOps health={p.health} adminOp={p.adminOp} onEnvSet={p.onEnvSet} onEnvUnset={p.onEnvUnset} onMcpAdd={p.onMcpAdd} onMcpRemove={p.onMcpRemove} onCliInstall={p.onCliInstall} />
        </div>
      )}
    </>
  );
}
