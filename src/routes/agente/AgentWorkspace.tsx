import { Button, EmptyState, SkeletonCards } from '../../components/primitives';
import { FilePreviewBody } from '../equipe/FilePreviewBody';
import type { BotFilesApi } from '../equipe/equipe-props';
import { formatSize } from '../equipe/file-groups';
import { useBotFilesTab } from '../equipe/useBotFilesTab';
import { BOT_SETTINGS_PATHS, isBotSettingsPath } from '../../../shared/bot-settings';
import { NewFileField } from './NewFileField';
import { SettingsGroup } from './SettingsGroup';
import { WorkspaceEditor } from './WorkspaceEditor';
import { useWorkspaceEditor } from './useWorkspaceEditor';
import { isEditablePath } from './workspace-edit';

interface AgentWorkspaceProps { botId: string; api: BotFilesApi; connected: boolean; canEdit?: boolean }

export function AgentWorkspace({ botId, api, connected, canEdit = false }: AgentWorkspaceProps) {
  const t = useBotFilesTab(botId, api, connected);
  const openText = t.openData?.status === 'ok' ? t.openData.text : undefined;
  const ed = useWorkspaceEditor(botId, api, { text: openText, mtime: t.openData?.status === 'ok' ? t.openData.mtime : undefined });
  const discard = () => !ed.dirty || window.confirm('Descartar as alterações não salvas?');
  const editable = canEdit && ed.canEdit && connected;
  const exists = (path: string) => !!api.botFiles[botId]?.some((f) => f.path === path);
  const create = (path: string) => { if (!discard()) return; t.open(path); ed.startNew(path); };
  const settings = (api.botFiles[botId] ?? []).filter((f) => isBotSettingsPath(f.path));
  const createSettings = () => { if (!discard()) return; t.open(BOT_SETTINGS_PATHS[0]); ed.startNew(BOT_SETTINGS_PATHS[0], '{}'); };
  const newFile = editable && <NewFileField exists={exists} onCreate={create} />;
  if (!t.loaded) return <SkeletonCards />;
  if (!t.groups.length && !ed.draft) {
    return (
      <EmptyState size="sm" icon="file" title="Nenhum arquivo ainda" description="O que o bot salvar no espaço de trabalho dele aparece aqui.">
        {newFile}
        <SettingsGroup files={settings} openPath={t.openPath} editable={editable} onPick={() => undefined} onCreate={createSettings} />
      </EmptyState>
    );
  }
  const pick = (path: string) => { if (!discard()) return; ed.cancel(); t.open(path); };
  return (
    <div className="grid grid-cols-[260px_minmax(0,1fr)] gap-3.5 max-lg:grid-cols-1">
      <nav aria-label="Workspace" className="flex max-h-[70vh] flex-col gap-0.5 overflow-y-auto rounded-2xl border border-(--border) bg-neutral-900/60 p-2 scroll-thin">
        <div className="flex flex-wrap items-center gap-1 px-2.5 pb-2 pt-1.5">
          <span className="grow text-[12px] font-medium text-(--text-weak)">Workspace</span>
          <Button variant="ghost" size="xs" icon="rotate" onClick={t.refresh} disabled={!connected}>Atualizar</Button>
          {newFile}
        </div>
        {t.groups.map((g) => ({ ...g, items: g.items.filter((f) => !isBotSettingsPath(f.path)) })).filter((g) => g.items.length > 0).map((g) => (
          <section key={g.label} aria-label={g.label} className="flex flex-col gap-0.5">
            <h3 className="flex min-h-7.5 items-center px-2.5 font-mono text-[12.5px] font-normal text-(--text-weak)">{g.label}</h3>
            {g.items.map((f) => {
              const on = f.path === t.openPath;
              return (
                <button key={f.path} type="button" aria-current={on || undefined} onClick={() => pick(f.path)} title={f.path}
                  className={`flex min-h-8.5 w-full items-center gap-2 rounded-lg px-2.5 pl-7 text-left font-mono text-[12.5px] transition ${on ? 'bg-(--accent-tint) text-(--accent-soft)' : 'text-(--text-body) hover:bg-neutral-800'}`}>
                  <span className="min-w-0 flex-1 truncate">{f.path.slice(f.path.lastIndexOf('/') + 1)}</span>
                  <span className="shrink-0 text-[11px] text-(--text-muted)">{formatSize(f.size)}</span>
                </button>
              );
            })}
          </section>
        ))}
        <SettingsGroup files={settings} openPath={t.openPath} editable={editable} onPick={pick} onCreate={createSettings} />
      </nav>
      <section aria-label="Arquivo" className="min-w-0 overflow-hidden rounded-2xl border border-(--border) bg-neutral-900/60">
        {ed.draft ? (
          <WorkspaceEditor path={ed.draft.path} text={ed.draft.text} dirty={ed.dirty} saving={ed.saving} error={ed.error}
            onChange={ed.change} onSave={ed.save} onCancel={() => { if (discard()) ed.cancel(); }} />
        ) : t.openPath ? (
          <>
            <div className="flex items-center gap-1 border-b border-(--border) px-3 py-2.5">
              <span className="min-w-0 flex-1 truncate font-mono text-[13px] font-medium text-(--text-strong)" title={t.openPath}>{t.openPath}</span>
              {editable && isEditablePath(t.openPath) && (
                <Button variant="secondary" size="sm" onClick={() => ed.start(t.openPath!)} disabled={openText === undefined}>Editar</Button>
              )}
              <Button variant="ghost" size="sm" onClick={t.close}>Fechar</Button>
            </div>
            <div className="p-3"><FilePreviewBody path={t.openPath} data={t.openData} /></div>
          </>
        ) : (
          <p className="p-6 text-[13px] text-(--text-muted)">Escolha um arquivo ao lado para ver o conteúdo.</p>
        )}
      </section>
    </div>
  );
}
