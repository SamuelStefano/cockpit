import { EGG_IDS, type EggId } from './eggs';

export const SECRET_HINT = 'Digite em qualquer lugar da tela, fora de campos de texto';

// How to trigger each egg, shown only once it has been found.
export const SECRET_HOW: Record<EggId, string> = {
  konami: '↑ ↑ ↓ ↓ ← → ← → B A (ou ⌘K e "konami")',
  iddqd: 'Digite iddqd (ou ⌘K e "iddqd")',
  matrix: 'Digite matrix (ou ⌘K e "matrix")',
  poke: 'Clique no Bit do painel 7 vezes seguidas',
  dizzy: 'Clique no Bit do painel 20 vezes seguidas',
  sudo: '⌘K e "sudo make me a sandwich"',
  halloween: 'Abra o Deck em 31 de outubro',
  friday: 'Abra o Deck numa sexta depois das 16h',
};

export interface SecretRow { id: EggId; found: boolean; how: string }

export function secretRows(found: string[]): SecretRow[] {
  return EGG_IDS.map((id) => ({ id, found: found.includes(id), how: found.includes(id) ? SECRET_HOW[id] : '???' }));
}

export const secretCount = (found: string[]): number => EGG_IDS.filter((e) => found.includes(e)).length;
