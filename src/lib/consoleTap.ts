export type TapLevel = 'log' | 'info' | 'warn' | 'error';

const LEVELS: Array<[keyof Console, TapLevel]> = [
  ['log', 'log'],
  ['info', 'info'],
  ['warn', 'warn'],
  ['error', 'error'],
  ['debug', 'log'],
];

function fmtArg(v: unknown): string {
  if (typeof v === 'string') return v;
  if (v instanceof Error) return v.message;
  try {
    const s = JSON.stringify(v);
    return s === undefined ? String(v) : s;
  } catch {
    return String(v);
  }
}

// Espelha console.* pro painel do sandbox sem devtools aberto. O código do modo
// App roda no documento do app, então não dá pra interceptar por postMessage como
// no iframe — resta grampear o console global. Preserva o console real (o log
// continua aparecendo no devtools) e devolve o restore, que o chamador PRECISA
// rodar no unmount, senão o grampo sobrevive à rota.
export function tapConsole(onLog: (level: TapLevel, text: string) => void): () => void {
  const installed: Array<[keyof Console, unknown, unknown]> = [];

  for (const [key, level] of LEVELS) {
    const orig = console[key] as ((...a: unknown[]) => void) | undefined;
    const wrapper = (...args: unknown[]) => {
      onLog(level, args.map(fmtArg).join(' '));
      orig?.apply(console, args);
    };
    (console as unknown as Record<string, unknown>)[key] = wrapper;
    installed.push([key, wrapper, orig]);
  }

  // Só desfaz se o console ainda for O NOSSO grampo: se outro tap entrou depois,
  // restaurar o snapshot cego arrancaria o grampo dele junto.
  return () => {
    for (const [key, wrapper, orig] of installed) {
      const box = console as unknown as Record<string, unknown>;
      if (box[key] === wrapper) box[key] = orig;
    }
  };
}
