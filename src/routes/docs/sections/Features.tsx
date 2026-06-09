import { SectionTitle, FeatureCard } from '../atoms';
import { FEATURES } from '../../docs.data';

export function Features() {
  return (
    <section id="features" className="mb-14 scroll-mt-6">
      <SectionTitle icon="grip" kicker="as abas" title="Funcionalidades"
        desc="Cada aba no topo é uma área de trabalho independente. A conexão com o agente nunca cai ao trocar de aba — você navega livre sem perder nada." />
      <div className="grid gap-3 sm:grid-cols-2">
        {FEATURES.map((f) => <FeatureCard key={f.title} icon={f.icon} tone={f.tone} title={f.title}>{f.body}</FeatureCard>)}
      </div>
    </section>
  );
}
