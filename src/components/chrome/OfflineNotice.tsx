import { useEffect, useState } from 'react';
import { Button, Icon } from '../primitives';
import { VpsConnectForm } from '../VpsConnectForm';
import { wsBase } from '../../cockpit/session';
import { getLastClose } from '../../app/connectionTelemetry';
import { causeMessage, type ConnCause } from '../../app/diag/connectionCause';
import type { ReconnectStatus } from '../../app/useReconnectAction';
import type { BoxInfo } from '../../../shared/boxes';
import { SUPABASE_ENABLED } from '../../lib/supabase';
import { BoxRecoverySteps } from './BoxRecoverySteps';
import { SendDiagButton } from './SendDiagButton';

// The host the socket really dials: a saved ws.url override or VITE_WS_URL, not
// necessarily the page's own host (the front on Vercel, the backend elsewhere).
export function backendHost(base = wsBase()): string {
  try { return new URL(base).host; } catch { return base; }
}

export function diagnosticLine(code: number | undefined, offlineSince: number | null | undefined, now = Date.now()): string | null {
  if (code == null) return null;
  const parts = [`código ${code}`];
  if (offlineSince != null) parts.push(`offline há ${Math.max(0, Math.round((now - offlineSince) / 1000))} s`);
  return parts.join(' · ');
}

interface Props {
  show: boolean;
  cause?: ConnCause | null;
  box?: BoxInfo | null;
  reconnect?: { status: ReconnectStatus; trigger: () => void };
  offlineSince?: number | null;
}

// One message per cause (login refused, no internet, relay down, box offline,
// agent silent), each with its next step. Anchored in the zero-height wrapper the
// App mounts under the header.
export function OfflineNotice({ show, cause, box = null, reconnect, offlineSince }: Props) {
  const [showConnect, setShowConnect] = useState(false);
  const [open, setOpen] = useState(false);
  const [, tick] = useState(0);
  const desktop = typeof window !== 'undefined' && window.matchMedia?.('(min-width: 1024px)').matches;
  useEffect(() => {
    if (!show) return;
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [show]);
  if (!show) return null;
  const msg = causeMessage(cause ?? 'relay-unreachable', { box, host: backendHost() });
  const diag = diagnosticLine(getLastClose()?.code, offlineSince);
  const network = !cause || cause === 'relay-unreachable' || cause === 'no-internet';
  return (
    <div className="fade-up pointer-events-none absolute left-1/2 top-2.5 z-40 w-[min(92vw,30rem)] -translate-x-1/2 max-lg:static max-lg:w-full max-lg:translate-x-0">
      <div role="alert" className="pointer-events-auto max-h-[80vh] overflow-y-auto rounded-lg border border-red-500/30 bg-red-500/12 px-3 py-2 shadow-2xl shadow-black/40 backdrop-blur-md max-lg:min-h-11 max-lg:rounded-none max-lg:border-x-0 max-lg:border-t-0 max-lg:py-1 max-lg:shadow-none">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-red-500/15 text-red-400">
            <Icon name="circle" size={13} />
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <button type="button" tabIndex={desktop ? -1 : undefined} aria-expanded={open} onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-1 text-left text-[13px] font-medium text-red-200 max-lg:min-h-11 lg:pointer-events-none">
              <span className="min-w-0 flex-1 truncate lg:whitespace-normal">{msg.title}</span>
              <Icon name={open ? 'chevronDown' : 'chevronRight'} size={14} className="lg:hidden" />
            </button>
            {reconnect && !open && (
              <Button variant="secondary" size="sm" icon="rotate" loading={reconnect.status === 'trying'} disabled={reconnect.status === 'trying'} onClick={reconnect.trigger} className="shrink-0 lg:hidden">
                Reconectar
              </Button>
            )}
            <div className={open ? '' : 'max-lg:hidden'}>
              <p className="text-[12px] text-red-200/70">{msg.body}</p>
              <p className="mt-0.5 text-[12px] text-red-100">{msg.step}</p>
              {msg.commands && <BoxRecoverySteps />}
              {diag && <p className="mt-1 text-[12px] text-red-200/50">{diag}</p>}
              {reconnect?.status === 'failed' && <p className="mt-1 text-[12px] text-red-200">Ainda sem conexão. {msg.step}</p>}
            </div>
            <div className={`mt-2 flex flex-wrap items-center gap-2 ${open ? '' : 'max-lg:hidden'}`}>
              {reconnect && (
                <Button variant="secondary" size="xs" icon="rotate" loading={reconnect.status === 'trying'} disabled={reconnect.status === 'trying'} onClick={reconnect.trigger}>
                  {reconnect.status === 'trying' ? 'Reconectando…' : 'Reconectar agora'}
                </Button>
              )}
              {SUPABASE_ENABLED && <SendDiagButton />}
              {network && (
                <Button variant="ghost" size="xs" icon={showConnect ? 'chevronDown' : 'chevronRight'} onClick={() => setShowConnect((v) => !v)}>
                  Configurar endereço do backend
                </Button>
              )}
            </div>
          </div>
        </div>
        {showConnect && (
          <div className="mt-3 border-t border-red-500/20 pt-3">
            <VpsConnectForm />
          </div>
        )}
      </div>
    </div>
  );
}
