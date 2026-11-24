import { useCallback, useEffect, useRef, useState } from 'react';
import type { BitState } from '../../components/bit/bit-state';
import { foundEgg } from '../../game/found-egg';

const QUIPS = ['Ei! Isso faz cócegas.', 'Estou compilando, juro.', 'Já commitou hoje?', 'Beep. Boop. Sem gracinha.'];
const RESET_MS = 4000;

// 7 pokes make Bit shake and talk; 20 make it dizzy. A pause of a few seconds
// restarts the count so scattered clicks over a session never add up by accident.
export function useBitPoke() {
  const [state, setState] = useState<BitState | null>(null);
  const [shake, setShake] = useState(false);
  const [quip, setQuip] = useState('');
  const count = useRef(0);
  const last = useRef(0);
  const timers = useRef<number[]>([]);

  useEffect(() => () => { for (const t of timers.current) clearTimeout(t); }, []);
  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)); };

  const poke = useCallback(() => {
    const now = Date.now();
    count.current = now - last.current > RESET_MS ? 1 : count.current + 1;
    last.current = now;
    if (count.current === 7) {
      foundEgg('poke');
      setQuip(QUIPS[Math.floor(Math.random() * QUIPS.length)]);
      setShake(true);
      later(() => setShake(false), 600);
      later(() => setQuip(''), 3500);
    } else if (count.current === 20) {
      count.current = 0;
      foundEgg('dizzy');
      setQuip('Tô tonto... 😵');
      setState('error');
      later(() => { setState(null); setQuip(''); }, 2800);
    }
  }, []);

  return { state, shake, quip, poke };
}
