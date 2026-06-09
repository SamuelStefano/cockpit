import { useState, useEffect, useRef } from 'react';

// Ejeção pro Dashboard de pareamento só quando faz sentido. Em T3 o relay
// anuncia agent-offline a cada reconexão do agent (ex: o terminate por buffer
// encalhado do fix do relay) — com o WS do SPA seguindo CONNECTED. Sem carência,
// cada flap jogava o usuário na tela de pareamento e voltava, sumindo header
// (perfil) + usage juntos, sem nem banner de offline.
//
// `connected` é o status do WS do SPA: enquanto ele não conectou, NÃO sabemos o
// estado do agent (o relay só anuncia agent-online/offline depois do connect).
// Decidir pareamento nessa janela mostrava a tela de "rode o comando" por ~1s a
// cada refresh, mesmo logado e já pareado. Só ejeta com WS conectado + agent
// ausente, com carência curta no boot (status pode chegar logo após o connect) e
// longa (~8s) depois de já ter estado online, pra atravessar o flap.
export function usePairingEject(agentOnline: boolean, uid: string | undefined, connected: boolean) {
  const everOnline = useRef(false);
  const [ejectPairing, setEjectPairing] = useState(false);
  useEffect(() => {
    if (agentOnline) { everOnline.current = true; setEjectPairing(false); return; }
    if (!connected) { setEjectPairing(false); return; }
    const grace = everOnline.current ? 8000 : 1500;
    const id = setTimeout(() => setEjectPairing(true), grace);
    return () => clearTimeout(id);
  }, [agentOnline, connected]);

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
