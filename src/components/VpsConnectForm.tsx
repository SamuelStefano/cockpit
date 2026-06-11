import { useState } from 'react';
import { Button, Icon, Input } from './primitives';
import { loadPref, savePref } from '../lib/persist';

// Configuração do backend por dispositivo (#147). Um build único no Vercel não
// tem como saber o endereço da VPS de cada aparelho; aqui o usuário cola o
// endereço do WS (ex: wss://deck.minha-tailnet.ts.net/ws) e, opcionalmente, o
// token. Salva no localStorage e recarrega — a conexão lê o override no mount.
export function VpsConnectForm({ onDone }: { onDone?: () => void }) {
  const [url, setUrl] = useState(() => loadPref('ws.url', ''));
  const [token, setToken] = useState(() => loadPref('auth.token', ''));
  const [urlErr, setUrlErr] = useState('');

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const u = url.trim();
    // Endereço inválido + location.reload() = tela quebrada sem pista do motivo.
    if (u && !/^wss?:\/\/.+/i.test(u)) {
      setUrlErr('O endereço precisa começar com ws:// ou wss:// — se você tem uma URL http(s)://, troque o http por ws (ou https por wss).');
      return;
    }
    savePref('ws.url', u);
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
        <Input
          mono
          error={!!urlErr}
          value={url}
          onChange={(e) => { setUrl(e.target.value); setUrlErr(''); }}
          placeholder="wss://sua-vps.ts.net/ws"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        {urlErr && <p className="mt-1.5 text-[11px] leading-relaxed text-red-300">{urlErr}</p>}
      </div>
      <div>
        <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-neutral-400">
          <Icon name="shield" size={12} /> Token <span className="text-neutral-600">(opcional)</span>
        </label>
        <Input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="COCKPIT_TOKEN do servidor"
        />
      </div>
      <Button type="submit" className="w-full">
        Salvar e conectar
      </Button>
      <p className="text-[11px] leading-relaxed text-neutral-600">
        Deixe o endereço em branco pra usar o servidor da mesma origem. O endereço e o token ficam salvos só neste navegador.
      </p>
    </form>
  );
}
