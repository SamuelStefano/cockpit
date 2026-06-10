// Altura estimada do menu com todos os itens (6 × ~30px + padding). Serve só
// pra decidir o lado de abertura; não precisa ser exata.
export const MENU_H = 230;

// Menu de ações abre pra cima quando não cabe abaixo do botão — sem isso, o
// dropdown de um card no fim da lista é cortado pelo viewport (pior no mobile).
export function shouldDropUp(buttonBottom: number, viewportH: number, menuH = MENU_H): boolean {
  return viewportH - buttonBottom < menuH;
}
