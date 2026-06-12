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
      <div className="mt-3">
        <Card>
          <div className="mb-3 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-neutral-400">
            <Icon name="sparkles" size={13} /> Truques escondidos
          </div>
          <ul className="grid gap-2 text-[12.5px] leading-snug text-neutral-400 sm:grid-cols-2">
            <li>• <span className="text-neutral-300">Setas ↑/↓ no composer vazio</span> navegam o histórico dos seus prompts.</li>
            <li>• <span className="text-neutral-300">Arrastar arquivos</span> em qualquer lugar do chat anexa (não só no clipe).</li>
            <li>• <span className="text-neutral-300">Toque longo</span> num card de sessão (mobile) abre o menu de ações.</li>
            <li>• <span className="text-neutral-300">Citar</span>: passe o mouse numa mensagem e use o balão pra responder com citação.</li>
            <li>• <span className="text-neutral-300">Editar e reenviar</span> sua última mensagem substitui o turno no lugar.</li>
            <li>• <span className="text-neutral-300">Tray de tarefas</span> acima do composer colapsa no clique e reabre quando quiser.</li>
            <li>• <span className="text-neutral-300">“carregar antigas”</span> no topo do chat traz o histórico pré-compactação.</li>
            <li>• <span className="text-neutral-300">Endereço do backend por aparelho</span>: no aviso de backend offline, “configurar endereço” salva um override neste dispositivo.</li>
            <li>• <span className="text-neutral-300">Rota /ds na URL</span> abre a galeria viva do design system.</li>
            <li>• <span className="text-neutral-300">Divisores finos</span> na timeline marcam compactação, PR aberta (link) e retomadas de loop.</li>
          </ul>
        </Card>
      </div>
    </section>
  );
}
