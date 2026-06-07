import { useState } from 'react';
import { Icon } from './primitives';
import { loadPref, savePref } from '../lib/persist';

// Configuração do backend por dispositivo (#147). Um build único no Vercel não
// tem como saber o endereço da VPS de cada aparelho; aqui o usuário cola o
// endereço do WS (ex: wss://deck.minha-tailnet.ts.net/ws) e, opcionalmente, o
// token. Salva no localStorage e recarrega — a conexão lê o override no mount.
export function VpsConnectForm({ onDone }: { onDone?: () => void }) {
  const [url, setUrl] = useState(() => loadPref('ws.url', ''));
  const [token, setToken] = useState(() => loadPref('auth.token', ''));

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    savePref('ws.url', url.trim());
    savePref('auth.token', token.trim());
    onDone?.();
    location.reload();
  };

  return (
    <form onSubmit={save} className="space-y-3">
      <div>
        <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-neutral-400">
          <Icon name="terminal" size={12} /> Endereço do backend
        </label>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="wss://sua-vps.ts.net/ws"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 font-mono text-[12.5px] text-neutral-200 outline-none transition focus:border-orange-500/40"
        />
      </div>
      <div>
        <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-neutral-400">
          <Icon name="shield" size={12} /> Token <span className="text-neutral-600">(opcional)</span>
        </label>
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="COCKPIT_TOKEN do servidor"
          className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-[13px] text-neutral-200 outline-none transition focus:border-orange-500/40"
        />
      </div>
      <button
        type="submit"
        className="w-full rounded-lg bg-orange-500 px-3 py-2 text-[13px] font-medium text-neutral-950 transition hover:bg-orange-400"
      >
        Salvar e conectar
      </button>
      <p className="text-[11px] leading-relaxed text-neutral-600">
        Deixe o endereço em branco pra usar o servidor da mesma origem. O endereço e o token ficam salvos só neste navegador.
      </p>
    </form>
  );
}
