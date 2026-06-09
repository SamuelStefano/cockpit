import { useState, useEffect, useRef } from 'react';

// Ejeção pro Dashboard de pareamento só quando faz sentido. Em T3 o relay
// anuncia agent-offline a cada reconexão do agent (ex: o terminate por buffer
// encalhado do fix do relay) — com o WS do SPA seguindo CONNECTED. Sem carência,
// cada flap jogava o usuário na tela de pareamento e voltava, sumindo header
// (perfil) + usage juntos, sem nem banner de offline. Latch: nunca pareado →
// mostra na hora; já esteve online → segura ~8s pra atravessar o flap.
export function usePairingEject(agentOnline: boolean, uid: string | undefined) {
  const everOnline = useRef(false);
  const [ejectPairing, setEjectPairing] = useState(false);
  useEffect(() => {
    if (agentOnline) { everOnline.current = true; setEjectPairing(false); return; }
    if (!everOnline.current) { setEjectPairing(true); return; }
    const id = setTimeout(() => setEjectPairing(true), 8000);
    return () => clearTimeout(id);
  }, [agentOnline]);

  // Troca de conta (sign-out → sign-in em outra) NÃO remonta o CockpitApp, então o
  // latch everOnline herdaria o pareamento da conta anterior e mostraria o chrome
  // dela pra uma conta nova ainda não-pareada. Ao mudar o user id, zera o latch e
  // volta pro pareamento até o agent da nova conta anunciar online.
  const prevUid = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (prevUid.current !== undefined && uid !== prevUid.current) {
      everOnline.current = false;
      setEjectPairing(!!uid);
    }
    prevUid.current = uid;
  }, [uid]);

  return ejectPairing;
}
