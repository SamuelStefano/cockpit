import { useState, useEffect, useRef, useCallback } from 'react';
import type { PointsEntry } from '../../../shared/protocol';
import { toast } from '../../components/primitives';

interface Args {
  connected: boolean;
  points: PointsEntry[];
  onPointsGet: () => void;
  onPointsAdd: (title: string, points: number, description?: string) => void;
  onPointsCorrect: (entryId: string, points: number) => void;
  onPointsNote: (entryId: string, description: string) => void;
  onPointsDelete: (entryId: string) => void;
}

// Lógica da rota Pontos: pede o ledger ao conectar, mantém um relógio pros tempos
// relativos, detecta entries recém-chegadas (glow "acabei de registrar") e envolve
// as mutações com toast. A UI só renderiza.
export function usePontos({ connected, points, onPointsGet, onPointsAdd, onPointsCorrect, onPointsNote, onPointsDelete }: Args) {
  const [now, setNow] = useState(() => Date.now());
  const [glowing, setGlowing] = useState<Set<string>>(new Set());
  const seen = useRef<Set<string> | null>(null);
  const glowTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => { if (connected) onPointsGet(); }, [connected, onPointsGet]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Entry cujo id ainda não estava no snapshot anterior = recém-registrada (pelo
  // agente ou por outro aparelho): acende o glow por ~2s. O 1º snapshot só semeia
  // o baseline (não pisca a lista inteira ao abrir a rota).
  useEffect(() => {
    const ids = new Set(points.map((p) => p.entryId));
    if (seen.current === null) { seen.current = ids; return; }
    const fresh = [...ids].filter((id) => !seen.current!.has(id));
    seen.current = ids;
    if (!fresh.length) return;
    setGlowing((prev) => new Set([...prev, ...fresh]));
    for (const id of fresh) {
      const old = glowTimers.current.get(id);
      if (old) clearTimeout(old);
      const t = setTimeout(() => {
        glowTimers.current.delete(id);
        setGlowing((prev) => { const n = new Set(prev); n.delete(id); return n; });
      }, 2200);
      glowTimers.current.set(id, t);
    }
  }, [points]);

  useEffect(() => () => { for (const t of glowTimers.current.values()) clearTimeout(t); }, []);

  const add = useCallback((title: string, pts: number, description?: string) => {
    onPointsAdd(title, pts, description);
    toast(`Registrado: ${title} (${pts} pts)`);
  }, [onPointsAdd]);

  const correct = useCallback((entryId: string, pts: number) => {
    onPointsCorrect(entryId, pts);
    toast(`Corrigido para ${pts} pts`);
  }, [onPointsCorrect]);

  const note = useCallback((entryId: string, description: string) => {
    onPointsNote(entryId, description);
  }, [onPointsNote]);

  const remove = useCallback((entryId: string) => {
    onPointsDelete(entryId);
    toast('Ponto excluído');
  }, [onPointsDelete]);

  return { now, glowing, add, correct, note, remove };
}
