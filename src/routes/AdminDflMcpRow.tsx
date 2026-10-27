import { Badge, Button } from '../components/primitives';
import type { DflMcpHostState, DflMcpStatus } from '../../shared/dfl-mcps';

const STATUS: Record<DflMcpStatus, { label: string; tone: 'green' | 'yellow' | 'red' | 'neutral' }> = {
  connected: { label: 'conectado', tone: 'green' },
  'needs-auth': { label: 'precisa entrar', tone: 'yellow' },
  failed: { label: 'falhou', tone: 'red' },
  missing: { label: 'não adicionado', tone: 'neutral' },
};

interface AdminDflMcpRowProps {
  host: DflMcpHostState;
  canLogin: boolean;
  onLogin: (host: DflMcpHostState) => void;
}

export function AdminDflMcpRow({ host, canLogin, onLogin }: AdminDflMcpRowProps) {
  const s = STATUS[host.status];
  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <div className="truncate text-[13px] text-neutral-200">{host.name}</div>
        <div className="truncate font-mono text-[12px] text-neutral-600" title={host.detail ?? host.endpoint}>{host.endpoint}</div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Badge tone={s.tone} dot>{s.label}</Badge>
        {host.status !== 'missing' && host.status !== 'connected' && (
          <Button variant="secondary" size="sm" icon="terminal" disabled={!canLogin} onClick={() => onLogin(host)}>Entrar</Button>
        )}
      </div>
    </li>
  );
}
