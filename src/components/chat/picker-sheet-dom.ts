// No celular o PickerSheet vai por portal pro <body>, fora da árvore de quem o
// abriu. Todo handler de clique-fora precisa reconhecer toque dentro dele — senão
// marcar uma skill fechava o seletor e a folha de ajustes junto.
export function isInsidePickerSheet(target: EventTarget | null): boolean {
  return target instanceof Element && !!target.closest('[data-picker-sheet]');
}
