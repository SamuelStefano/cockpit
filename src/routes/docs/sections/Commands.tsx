import { Icon } from '../../../components/primitives';
import { Pill, Kbd, SectionTitle, Card } from '../atoms';
import { SLASH, KEYS } from '../../docs.data';

export function Commands() {
  return (
    <section id="comandos" className="mb-14 scroll-mt-6">
      <SectionTitle icon="command" kicker="produtividade" title="Comandos & atalhos"
        desc="Comandos com barra (/) controlam a sessão direto do campo de mensagem; atalhos de teclado aceleram o resto. O app interpreta os comandos conhecidos localmente — o que ele não reconhece vai pro agente como texto." />
      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-neutral-400">
            <Icon name="terminal" size={13} /> Comandos com barra
          </div>
          <div className="space-y-2.5">
            {SLASH.map((s) => (
              <div key={s.cmd} className="flex items-baseline gap-3">
                <span className="shrink-0"><Pill>{s.cmd}</Pill></span>
                <span className="text-[12.5px] leading-snug text-neutral-400">{s.desc}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <div className="mb-3 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-neutral-400">
            <Icon name="command" size={13} /> Atalhos de teclado
          </div>
          <div className="space-y-2.5">
            {KEYS.map((k) => (
              <div key={k.desc} className="flex items-center justify-between gap-3">
                <span className="text-[12.5px] leading-snug text-neutral-400">{k.desc}</span>
                <span className="flex shrink-0 items-center gap-1">{k.keys.map((key) => <Kbd key={key}>{key}</Kbd>)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </section>
  );
}
