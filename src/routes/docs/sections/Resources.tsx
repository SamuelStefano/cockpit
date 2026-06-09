import { SectionTitle, ResourceRow, Callout } from '../atoms';
import { RESOURCES } from '../../docs.data';

export function Resources() {
  return (
    <section id="recursos" className="mb-14 scroll-mt-6">
      <SectionTitle icon="zap" kicker="telemetria" title="Recursos da máquina"
        desc="Os medidores no rodapé e no Admin mostram a saúde da VPS em tempo real. Tudo é lido direto do sistema operacional, sem instalar nada — leituras best-effort que nunca derrubam o app." />
      <div className="space-y-3">
        {RESOURCES.map((r) => <ResourceRow key={r.key} r={r} />)}
      </div>
      <Callout icon="zap" tone="amber">
        <span className="font-medium">Watchdog automático ·</span> se CPU ou RAM ficarem saturadas por tempo demais,
        o Deck sinaliza e pode agir pra evitar travar a máquina inteira.
      </Callout>
    </section>
  );
}
