type Handle = number;

export interface TimerJail {
  scope: Record<string, unknown>;
  clear: () => void;
}

// Timers do código do sandbox rodam no documento do app: um setInterval de uma
// versão antiga do código sobreviveria pra sempre, disparando setState em
// componente desmontado e acumulando a cada tecla digitada. Aqui cada build ganha
// seus próprios setTimeout/setInterval/rAF, e a build seguinte cancela os da anterior.
export function createTimerJail(): TimerJail {
  const timeouts = new Set<Handle>();
  const intervals = new Set<Handle>();
  const frames = new Set<Handle>();

  const scope = {
    setTimeout: (fn: () => void, ms?: number, ...args: unknown[]): Handle => {
      const id = window.setTimeout((...a: unknown[]) => {
        timeouts.delete(id);
        (fn as (...a: unknown[]) => void)(...a);
      }, ms, ...args);
      timeouts.add(id);
      return id;
    },
    clearTimeout: (id?: Handle) => {
      if (id === undefined) return;
      timeouts.delete(id);
      window.clearTimeout(id);
    },
    setInterval: (fn: () => void, ms?: number, ...args: unknown[]): Handle => {
      const id = window.setInterval(fn, ms, ...args);
      intervals.add(id);
      return id;
    },
    clearInterval: (id?: Handle) => {
      if (id === undefined) return;
      intervals.delete(id);
      window.clearInterval(id);
    },
    requestAnimationFrame: (fn: FrameRequestCallback): Handle => {
      const id = window.requestAnimationFrame((t) => {
        frames.delete(id);
        fn(t);
      });
      frames.add(id);
      return id;
    },
    cancelAnimationFrame: (id?: Handle) => {
      if (id === undefined) return;
      frames.delete(id);
      window.cancelAnimationFrame(id);
    },
  };

  return {
    scope,
    clear: () => {
      for (const id of timeouts) window.clearTimeout(id);
      for (const id of intervals) window.clearInterval(id);
      for (const id of frames) window.cancelAnimationFrame(id);
      timeouts.clear();
      intervals.clear();
      frames.clear();
    },
  };
}
