import { Bit } from '../components/bit/Bit';
import type { BitState } from '../components/bit/bit-state';
import { AgentFlow } from './AgentFlow';
import './agents.css';

export function AgentsHero({ state, done }: { state: BitState; done: number }) {
  return (
    <section className="flex items-start gap-3 sm:gap-4">
      <Bit state={state} size={76} className="mt-1" />
      <div className="min-w-0 flex-1">
        <p className="agent-bubble relative rounded-2xl border border-neutral-800 bg-neutral-900/60 px-4 py-3 text-[13px] leading-relaxed text-neutral-300">
          <strong className="font-semibold text-neutral-100">Oi! Eu sou o Bit.</strong> Aqui você liga outros agentes de IA ao Deck — Grok, Gemini, Codex… Escolha um, siga os 3 passos e eu testo pra você.
        </p>
        <div className="mt-3 overflow-x-auto"><AgentFlow done={done} /></div>
      </div>
    </section>
  );
}
