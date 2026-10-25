import { Button, EmptyState, SkeletonCards } from '../../components/primitives';
import type { BotFilesApi } from './equipe-props';
import { BotFilePreview } from './BotFilePreview';
import { BotFileRow } from './BotFileRow';
import { useBotFilesTab } from './useBotFilesTab';

interface BotFilesProps { botId: string; api: BotFilesApi; connected: boolean }

export function BotFiles({ botId, api, connected }: BotFilesProps) {
  const t = useBotFilesTab(botId, api, connected);
  if (t.openPath) return <BotFilePreview path={t.openPath} data={t.openData} onBack={t.close} />;
  if (!t.loaded) return <div className="p-3"><SkeletonCards /></div>;
  if (!t.groups.length) {
    return <EmptyState icon="file" title="Nenhum arquivo ainda" description="O que o bot salvar no espaço de trabalho dele aparece aqui." />;
  }
  return (
    <div className="flex flex-col gap-3 px-2 py-3">
      <div className="flex justify-end">
        <Button variant="ghost" size="xs" icon="rotate" onClick={t.refresh} disabled={!connected}>Atualizar</Button>
      </div>
      {t.groups.map((g) => (
        <section key={g.label} aria-label={g.label}>
          <h3 className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{g.label}</h3>
          {g.items.map((f) => <BotFileRow key={f.path} file={f} onOpen={t.open} />)}
        </section>
      ))}
    </div>
  );
}
