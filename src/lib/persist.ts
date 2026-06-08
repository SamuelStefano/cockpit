import { useState, useEffect, useRef, useCallback, type Dispatch, type SetStateAction } from 'react';

// Prefs de UI local (não-sensível): largura de painéis, modo, rota. Só primitivos
// JSON. Falha silenciosa se localStorage indisponível (SSR/privado).
const NS = 'cockpit:';

export function loadPref<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(NS + key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function savePref<T>(key: string, value: T): void {
  try {
    localStorage.setItem(NS + key, JSON.stringify(value));
  } catch {
    /* best-effort */
  }
}

// Pub/sub por chave: instâncias diferentes de usePersisted com a MESMA key
// (ex: 'pinned' usado no sidebar e na navegação por teclado) se mantêm em
// sincronia no mesmo render, sem precisar de reload.
const listeners = new Map<string, Set<(v: unknown) => void>>();

// Escrita por um produtor de FORA do React (ex: hidratação do perfil vinda do
// Supabase): grava o cache e notifica TODOS os usePersisted daquela key, então a
// UI reflete o valor remoto sem reload. savePref sozinho não avisa os hooks.
export function setPref<T>(key: string, value: T): void {
  savePref(key, value);
  const set = listeners.get(key);
  if (set) for (const fn of set) fn(value);
}

function subscribe(key: string, fn: (v: unknown) => void): () => void {
  let set = listeners.get(key);
  if (!set) { set = new Set(); listeners.set(key, set); }
  set.add(fn);
  return () => { set!.delete(fn); };
}

function broadcast(key: string, value: unknown, self: (v: unknown) => void): void {
  const set = listeners.get(key);
  if (!set) return;
  for (const fn of set) if (fn !== self) fn(value);
}

export function usePersisted<T>(key: string, fallback: T): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => loadPref(key, fallback));
  const selfRef = useRef<(v: unknown) => void>((v) => setValue(v as T));
  useEffect(() => subscribe(key, selfRef.current), [key]);
  const set = useCallback<Dispatch<SetStateAction<T>>>((action) => {
    setValue((prev) => {
      const next = typeof action === 'function' ? (action as (p: T) => T)(prev) : action;
      savePref(key, next);
      broadcast(key, next, selfRef.current);
      return next;
    });
  }, [key]);
  return [value, set];
}
