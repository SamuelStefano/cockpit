import { useEffect } from 'react';
import { usePersisted } from '../lib/persist';
import { TERMINALS_SEED, type Terminal } from '../data/types';
import type { TermApi } from '../useCockpit';

let _tid = 100;
const nextId = (p: string) => `${p}${++_tid}`;

export function useTerminalTabs(term: TermApi, discoveredTerms: string[] = [], listTerms?: () => void) {
  const [terminals, setTerminals] = usePersisted<Terminal[]>('terminals', TERMINALS_SEED);
  const [activeTermId, setActiveTermId] = usePersisted('term.active', 'main');

  // Evita colisão de id ao criar abas após restaurar do localStorage.
  useEffect(() => {
    for (const t of terminals) {
      const n = Number(t.id.replace(/^term-/, ''));
      if (Number.isFinite(n) && n > _tid) _tid = n;
    }
    listTerms?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sessões tmux vivas no servidor que ainda não estão abertas como aba aqui:
  // permite reanexar (as "branches" persistentes da VPS, visíveis de outro device).
  // `w-*` panes follow a session transcript for the canvas; they are not shells.
  const attachable = discoveredTerms.filter((id) => !id.startsWith('w-') && !terminals.some((t) => t.id === id));

  // Aba com sessão VIVA no servidor. Era `terminals[0]`, que existe sempre (a semente
  // 'main'), então o ponto verde de "tem terminal rodando" ficava aceso pra sempre.
  const runningTerm = terminals.find((t) => discoveredTerms.includes(t.id));

  const attachExisting = (id: string) => {
    // Sessão descoberta no servidor pode ser `term-NNN` acima do contador atual;
    // sobe o _tid pra um novo tab nunca colidir com ela (id/key duplicado).
    const n = Number(/^term-(\d+)$/.exec(id)?.[1]);
    if (Number.isFinite(n) && n > _tid) _tid = n;
    if (terminals.some((t) => t.id === id)) { setActiveTermId(id); return; }
    setTerminals((prev) => [...prev, { id, name: id }]);
    setActiveTermId(id);
  };

  const handleAddTerm = () => {
    const id = nextId('term-');
    // Nome derivado do id monotônico: com `terminals.length + 1`, fechar uma aba do
    // meio e criar outra repetia o nome de uma aba existente.
    setTerminals((prev) => [...prev, { id, name: `shell ${id.replace('term-', '')}` }]);
    setActiveTermId(id);
  };

  // Fora do updater do setTerminals: o React pode reexecutá-lo, e um setState de
  // outro estado lá dentro não é puro.
  const handleCloseTerm = (id: string) => {
    term.kill(id);
    const next = terminals.filter((t) => t.id !== id);
    setTerminals(next);
    if (id === activeTermId && next.length) setActiveTermId(next[0].id);
  };

  return { terminals, activeTermId, setActiveTermId, handleAddTerm, handleCloseTerm, attachable, attachExisting, runningTerm };
}
