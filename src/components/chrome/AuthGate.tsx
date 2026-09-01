import { useState } from 'react';
import { BrandMark, Button, Icon, Input } from '../primitives';
import { VpsConnectForm } from '../VpsConnectForm';

// Tela de login (DR-011 Fase 2). Só aparece quando o servidor exige token
// (COCKPIT_TOKEN setado) e o nosso falta/está errado — o WS volta com close 4401.
// Single-account: o token É a identidade. Fica salvo no navegador; sem servidor
// de sessão. Substitui o app inteiro até a conexão autenticar.
export function AuthGate({ onSubmit }: { onSubmit: (token: string) => void }) {
  const [token, setToken] = useState('');
  const [showConnect, setShowConnect] = useState(false);
  const submit = (e: React.FormEvent) => { e.preventDefault(); if (token.trim()) onSubmit(token); };
  return (
    <div className="flex h-full flex-1 items-center justify-center bg-neutral-950 px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-900/60 p-7 shadow-2xl">
        <BrandMark title="deck" subtitle="acesso restrito" className="mb-5" />
        <label htmlFor="gate-token" className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-neutral-400">
          <Icon name="shield" size={12} /> Token de acesso
        </label>
        <Input
          id="gate-token"
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          autoFocus
          placeholder="cole o token do servidor"
        />
        <Button type="submit" disabled={!token.trim()} className="mt-3 w-full">Entrar</Button>
        <p className="mt-3 text-[11px] leading-relaxed text-neutral-600">
          Este Deck controla a VPS. O token vem da variável <span className="font-mono text-neutral-500">COCKPIT_TOKEN</span> do servidor
          e fica salvo só neste navegador.
        </p>
        <button
          type="button"
          onClick={() => setShowConnect((v) => !v)}
          className="mt-3 flex items-center gap-1.5 text-[11px] text-neutral-500 transition hover:text-neutral-300"
        >
          <Icon name={showConnect ? 'chevronDown' : 'chevronRight'} size={12} /> Configurar endereço do backend
        </button>
        {showConnect && (
          <div className="mt-3 border-t border-neutral-800 pt-3">
            <VpsConnectForm />
          </div>
        )}
      </form>
    </div>
  );
}
