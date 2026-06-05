import { useState, useEffect } from 'react';

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

export function usePersisted<T>(key: string, fallback: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => loadPref(key, fallback));
  useEffect(() => {
    savePref(key, value);
  }, [key, value]);
  return [value, setValue];
}
