import { useState } from 'react';
import { Icon } from '../primitives';
import { VpsConnectForm } from '../VpsConnectForm';
import { wsBase } from '../../cockpit/session';

// The host the socket really dials: a saved ws.url override or VITE_WS_URL, not
// necessarily the page's own host (the front on Vercel, the backend elsewhere).
export function backendHost(base = wsBase()): string {
  try { return new URL(base).host; } catch { return base; }
}

// Aviso honesto quando o backend não responde por alguns segundos (caso clássico:
// front no Vercel sem túnel pro backend loopback). Evita a sensação de "app quebrado".
// Ancora no wrapper de altura zero que o App monta logo abaixo do header: o `top`
// mágico de 58px saía do lugar quando a safe-area do iPhone empurrava o header.
export function OfflineNotice({ show, onReconnect }: { show: boolean; onReconnect?: () => void }) {
  const [showConnect, setShowConnect] = useState(false);
  if (!show) return null;
  return (
    <div className="fade-up pointer-events-none absolute left-1/2 top-2.5 z-40 w-[min(92vw,30rem)] -translate-x-1/2">
      <div className="pointer-events-auto rounded-lg border border-red-500/30 bg-red-500/12 px-3 py-2 shadow-2xl shadow-black/40 backdrop-blur-md">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-red-500/15 text-red-400">
            <Icon name="circle" size={13} />
          </span>
          <div className="leading-tight">
            <p className="text-[12px] font-medium text-red-200">Backend não acessível</p>
            <p className="text-[11px] text-red-200/70">
              O Deck não alcança o servidor em <span className="font-mono">{backendHost()}</span>. Confira se o backend está rodando (ou o túnel/Tailscale). Tentando reconectar…
            </p>
            {onReconnect && (
              <button
                type="button"
                onClick={onReconnect}
                className="mt-1.5 mr-3 inline-flex items-center gap-1.5 text-[11px] font-medium text-red-100 transition hover:text-white"
              >
                <Icon name="rotate" size={12} /> Reconectar agora
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowConnect((v) => !v)}
              className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-medium text-red-200/80 transition hover:text-red-100"
            >
              <Icon name={showConnect ? 'chevronDown' : 'chevronRight'} size={12} /> Configurar endereço do backend
            </button>
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
