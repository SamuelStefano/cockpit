import { useCallback, useEffect, useState } from 'react';

// Overlays de topo do app. Duas invariantes que antes ficavam espalhadas nos
// call sites do JSX:
//
// 1. Drawer de sessões e menu de rotas são mutuamente exclusivos — abrir um sem
//    fechar o outro sobrepõe os dois no mobile.
// 2. Drawer e terminal sheet vivem no MobileLayout, que só monta na rota de chat.
//    Navegar desmonta o DOM mas o estado persistia, e o overlay reaparecia sozinho
//    ao voltar pra '/'.
export function useOverlays(route: string) {
  const [drawer, setDrawerState] = useState(false);
  const [termSheet, setTermSheet] = useState(false);
  const [routeMenu, setRouteMenuState] = useState(false);
  const [palette, setPalette] = useState(false);
  const [help, setHelp] = useState(false);

  const setDrawer = useCallback((v: boolean) => {
    setDrawerState(v);
    if (v) setRouteMenuState(false);
  }, []);
  const setRouteMenu = useCallback((v: boolean) => {
    setRouteMenuState(v);
    if (v) setDrawerState(false);
  }, []);

  useEffect(() => {
    setDrawerState(false);
    setTermSheet(false);
    setRouteMenuState(false);
  }, [route]);

  return { drawer, setDrawer, termSheet, setTermSheet, routeMenu, setRouteMenu, palette, setPalette, help, setHelp };
}
