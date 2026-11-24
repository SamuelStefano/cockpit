export interface Store<T> { get: () => T; set: (next: T) => void; subscribe: (fn: () => void) => () => void }

export function createStore<T>(initial: T): Store<T> {
  let value = initial;
  const subs = new Set<() => void>();
  return {
    get: () => value,
    set: (next) => { value = next; for (const fn of subs) fn(); },
    subscribe: (fn) => { subs.add(fn); return () => { subs.delete(fn); }; },
  };
}
