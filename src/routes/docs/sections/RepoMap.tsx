import { Icon } from '../../../components/primitives';
import { FILEMAP } from '../../docs.data';
import { SectionTitle, Card, Pill } from '../atoms';

export function RepoMap() {
  return (
    <section id="repo" className="mb-10 scroll-mt-6">
      <SectionTitle icon="file" kicker="para desenvolvedores" title="Mapa do repositório"
        desc="A vista de quem mexe no código: o que cada arquivo importante faz, agrupado por área. A maioria dos arquivos tem um vizinho .test ao lado (convenção do projeto), omitido aqui pra não poluir." />
      <div className="space-y-5">
        {FILEMAP.map((g) => (
          <Card key={g.group}>
            <div className="mb-3 flex items-center gap-2">
              <span className={`flex h-7 w-7 items-center justify-center rounded-lg border ${g.tone}`}>
                <Icon name="file" size={13} />
              </span>
              <h3 className="text-[13.5px] font-semibold text-neutral-100">{g.group}</h3>
            </div>
            <div className="space-y-2">
              {g.files.map((f) => (
                <div key={f.path} className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
                  <span className="shrink-0 sm:w-60"><Pill>{f.path}</Pill></span>
                  <span className="text-[12.5px] leading-snug text-neutral-400">{f.what}</span>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
