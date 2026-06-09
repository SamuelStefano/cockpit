import { createContext, useContext } from 'react';

// Resolver de wikilink injetado pelo viewer de contexto. `null` = sem provider
// (ex: markdown do chat), e aí o WikiLink renderiza só o chip estático — mesmo
// comportamento de antes, sem regressão. Quando há resolver, o chip vira botão
// que navega pro `[[alvo]]` referenciado.
export type WikilinkResolver = (name: string) => void;

export const WikilinkContext = createContext<WikilinkResolver | null>(null);

const chip = 'rounded bg-orange-500/10 px-1 py-px font-medium text-orange-300/90 ring-1 ring-inset ring-orange-500/20';

export function WikiLink({ value }: { value: string }) {
  const resolve = useContext(WikilinkContext);
  if (!resolve) return <span className={chip}>{value}</span>;
  return (
    <button
      type="button"
      onClick={() => resolve(value)}
      className={`${chip} cursor-pointer transition hover:bg-orange-500/20 hover:text-orange-200`}
    >
      {value}
    </button>
  );
}
