import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { canAdoptPasskey, passkeyDevice } from '../../cockpit/device-store';
import { unlockWithPasskey, webauthnAvailable } from '../../cockpit/passkey';
import { retrySeal } from '../../cockpit/sealed-socket';

export interface PasskeySetup {
  // Worth offering: WebAuthn exists and switching keys orphans no pin.
  offer: boolean;
  active: boolean;
  version: number;
  busy: boolean;
  err: string;
  unsupported: boolean;
  use: () => void;
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

  useEffect(() => {
    let live = true;
    void (async () => {
      const has = !!(await passkeyDevice().catch(() => null));
      const can = webauthnAvailable() && (await canAdoptPasskey().catch(() => false));
      if (live) { setActive(has); setOffer(can && !has); }
    })();
    return () => { live = false; };
  }, [version]);

  const run = async (mode: 'get' | 'create') => {
    setBusy(true);
    setErr('');
    try {
      if ((await unlockWithPasskey(mode, await currentUser())) === 'unsupported') { setUnsupported(true); return; }
      setVersion((v) => v + 1);
      retrySeal();
    } catch {
      setErr(mode === 'get' ? 'nenhuma passkey usada — se é a primeira vez, crie uma' : 'não deu pra criar a passkey');
    } finally {
      setBusy(false);
    }
  };

  return { offer, active, version, busy, err, unsupported, use: () => void run('get'), create: () => void run('create') };
}
