import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { passkeyDevice } from '../../cockpit/device-store';
import { unlockWithPasskey, webauthnAvailable } from '../../cockpit/passkey';
import { retrySeal } from '../../cockpit/sealed-socket';

export interface PasskeySetup {
  // Worth offering: WebAuthn exists and this browser has no passkey key yet.
  offer: boolean;
  active: boolean;
  version: number;
  busy: boolean;
  err: string;
  unsupported: boolean;
  // "Criar" waits on an explicit confirmation: a new passkey replaces the key
  // of every browser the old one synced to.
  confirming: boolean;
  use: () => void;
  askCreate: () => void;
  cancelCreate: () => void;
  create: () => void;
}

async function currentUser(): Promise<{ id: string; name: string }> {
  const s = (await supabase?.auth.getSession())?.data.session;
  return { id: s?.user.id ?? 'local', name: s?.user.email ?? 'Deck' };
}

export function usePasskeySetup(): PasskeySetup {
  const [offer, setOffer] = useState(false);
  const [active, setActive] = useState(false);
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [unsupported, setUnsupported] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    let live = true;
    void (async () => {
      const has = !!(await passkeyDevice().catch(() => null));
      if (live) { setActive(has); setOffer(webauthnAvailable() && !has); }
    })();
    return () => { live = false; };
  }, [version]);

  const run = async (mode: 'get' | 'create') => {
    setBusy(true);
    setErr('');
    setConfirming(false);
    try {
      if ((await unlockWithPasskey(mode, await currentUser())) === 'unsupported') { setUnsupported(true); return; }
      setVersion((v) => v + 1);
      retrySeal();
    } catch {
      setErr(mode === 'get' ? 'nenhuma passkey usada — se você nunca criou uma, crie abaixo' : 'não deu pra criar a passkey');
    } finally {
      setBusy(false);
    }
  };

  return {
    offer, active, version, busy, err, unsupported, confirming,
    use: () => void run('get'),
    askCreate: () => setConfirming(true),
    cancelCreate: () => setConfirming(false),
    create: () => void run('create'),
  };
}
