import { SectionTitle, Card, Callout } from '../atoms';

export function Modes() {
  return (
    <section id="modos" className="mb-14 scroll-mt-6">
      <SectionTitle icon="shield" kicker="controle" title="Modos & permissões"
        desc="Você decide quanta liberdade o agente tem em cada sessão. Do mais cauteloso ao mais autônomo — o seletor fica logo acima do campo de mensagem." />
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="border-neutral-700">
          <div className="mb-2 inline-flex rounded-md bg-neutral-800 px-2 py-1 text-[11px] font-medium text-neutral-100">Planejar</div>
          <p className="text-[13px] leading-relaxed text-neutral-400">O agente só descreve o plano. Nada é editado nem executado. Ideal pra alinhar a abordagem antes.</p>
        </Card>
        <Card className="border-amber-500/30">
          <div className="mb-2 inline-flex rounded-md bg-amber-500/20 px-2 py-1 text-[11px] font-medium text-amber-300">Auto</div>
          <p className="text-[13px] leading-relaxed text-neutral-400">Edita e lê arquivos sozinho, mas não roda comandos no shell. Bom meio-termo pra mexer em código.</p>
        </Card>
        <Card className="border-orange-500/30">
          <div className="mb-2 inline-flex rounded-md bg-orange-500/20 px-2 py-1 text-[11px] font-medium text-orange-300">Executar</div>
          <p className="text-[13px] leading-relaxed text-neutral-400">Liberdade total dentro das regras: edita arquivos e roda comandos. O modo de trabalho de verdade.</p>
        </Card>
      </div>
      <Callout icon="shield-off" tone="red">
        <span className="font-medium">Bypass (admin) ·</span> um interruptor que deixa o agente rodar qualquer comando sem pedir aprovação.
        Vem desligado, é restrito a administrador e deve ser usado com muito cuidado — desligue assim que terminar.
      </Callout>
    </section>
  );
}
