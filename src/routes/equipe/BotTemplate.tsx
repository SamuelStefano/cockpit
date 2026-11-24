import type { SkillMeta } from '../../../shared/protocol';
import type { ImportedDraft } from '../../../shared/agent-template';
import { Button, Modal } from '../../components/primitives';
import type { BotDraft } from './useBotForm';
import { useBotTemplate } from './useBotTemplate';

interface BotTemplateProps {
  draft: BotDraft;
  skills: SkillMeta[];
  onImport: (d: ImportedDraft) => void;
  onClose: () => void;
}

export function BotTemplate({ draft, skills, onImport, onClose }: BotTemplateProps) {
  const t = useBotTemplate({ draft, skills });
  const submit = () => {
    const d = t.read();
    if (d) onImport(d);
  };
  return (
    <Modal open onClose={onClose} title="Compartilhar agente" icon="link" maxWidth="max-w-xl">
      <div className="flex flex-col gap-4">
        <section className="flex flex-col gap-2">
          <h3 className="text-[12px] font-semibold uppercase tracking-wide text-neutral-500">Enviar este agente</h3>
          <p className="text-[13px] text-neutral-400">Vai só o nome, o cargo, as instruções, o visual e as habilidades. Nenhuma senha, chave ou conversa.</p>
          {t.exportError && <p role="alert" className="text-[13px] text-red-400">{t.exportError}</p>}
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" icon="link" disabled={!!t.exportError} onClick={() => t.copy('link')}>{t.copied === 'link' ? 'Link copiado' : 'Copiar link'}</Button>
            <Button variant="secondary" size="sm" icon="copy" disabled={!!t.exportError} onClick={() => t.copy('json')}>{t.copied === 'json' ? 'Arquivo copiado' : 'Copiar como arquivo'}</Button>
          </div>
        </section>
        <section className="flex flex-col gap-2">
          <h3 className="text-[12px] font-semibold uppercase tracking-wide text-neutral-500">Receber um agente</h3>
          <textarea aria-label="Agente para importar" rows={4} value={t.text} onChange={(e) => t.setText(e.target.value)} placeholder="Cole aqui o link ou o arquivo do agente"
            className="w-full resize-y rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-[13px] text-neutral-200 outline-hidden focus:border-orange-500/40" />
          {t.error && <p role="alert" className="text-[13px] text-red-400">{t.error}</p>}
          <div><Button variant="primary" size="sm" icon="download" disabled={!t.text.trim()} onClick={submit}>Usar este agente</Button></div>
        </section>
      </div>
    </Modal>
  );
}
