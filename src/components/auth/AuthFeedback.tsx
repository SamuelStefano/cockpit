// Faixas de erro (vermelha) e confirmação (verde) das telas de conta. Extraídas
// do gate pra recuperação e troca de senha falarem no mesmo tom visual.
export function AuthFeedback({ error, info }: { error?: string; info?: string }) {
  return (
    <>
      {error && <p role="alert" className="mt-3 rounded-md border border-red-500/30 bg-red-500/12 px-3 py-2 text-[11.5px] text-red-200">{error}</p>}
      {info && <p className="mt-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11.5px] text-emerald-200">{info}</p>}
    </>
  );
}
