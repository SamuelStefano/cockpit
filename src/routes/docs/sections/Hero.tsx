import { Icon } from '../../../components/primitives';

export function Hero() {
  return (
    <div className="mb-12 overflow-hidden rounded-3xl border border-neutral-800 bg-gradient-to-br from-orange-500/[0.08] via-neutral-900/40 to-neutral-950 p-7 sm:p-9">
      <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-[11px] font-medium text-orange-300">
        <Icon name="terminal" size={12} /> Deck
      </div>
      <h1 className="text-[30px] font-bold leading-tight tracking-tight text-neutral-50 sm:text-[36px]">
        Seu posto de comando<br className="hidden sm:block" /> pra trabalhar com o Claude.
      </h1>
      <p className="mt-4 max-w-2xl text-[14.5px] leading-relaxed text-neutral-400">
        O Deck é uma interface pessoal que roda na sua VPS pra conversar com o agente,
        acompanhar a máquina em tempo real, gerenciar contextos e abrir terminais — tudo num lugar só.
        Esta página explica cada peça, do botão de busca ao que acontece nos bastidores.
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        {['Tempo real', 'Roda local (127.0.0.1)', 'Memória persistente', 'Terminais reais'].map((t) => (
          <span key={t} className="rounded-lg border border-neutral-800 bg-neutral-900/60 px-2.5 py-1 text-[11.5px] text-neutral-400">{t}</span>
        ))}
      </div>
    </div>
  );
}
