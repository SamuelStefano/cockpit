import { Button, Modal } from '../../components/primitives';

interface Preset { name: string; hint: string; tone: string; text: string; ready: boolean }

const PRESETS: Preset[] = [
  { name: 'DevFellowship', hint: 'campaigns, work, studio…', tone: 'bg-orange-950 text-orange-300', text: 'DF', ready: true },
  { name: 'GitHub', hint: 'em breve', tone: 'bg-neutral-800 text-neutral-200', text: 'GH', ready: false },
  { name: 'Gmail', hint: 'em breve', tone: 'bg-rose-950 text-rose-300', text: 'M', ready: false },
  { name: 'Google Drive', hint: 'em breve', tone: 'bg-emerald-950 text-emerald-300', text: 'D', ready: false },
  { name: 'Slack', hint: 'em breve', tone: 'bg-purple-950 text-purple-300', text: 'S', ready: false },
  { name: 'Notion', hint: 'em breve', tone: 'bg-neutral-800 text-neutral-200', text: 'N', ready: false },
];

interface Props { open: boolean; busy: boolean; onClose: () => void; onConnect: () => void }

export function ConnectTool({ open, busy, onClose, onConnect }: Props) {
  return (
    <Modal open={open} onClose={onClose} title="Conectar ferramenta" icon="link" maxWidth="max-w-xl">
      <p className="text-[13px] leading-relaxed text-neutral-400">Escolha o que a equipe vai poder usar. Você entra na sua conta e decide o que ela pode ler ou escrever.</p>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {PRESETS.map((p) => (
          <button key={p.name} type="button" disabled={!p.ready || busy} onClick={onConnect}
            className="flex items-center gap-2.5 rounded-xl border border-neutral-800 bg-neutral-900 p-2.5 text-left transition-colors enabled:hover:border-orange-500/40 disabled:opacity-50">
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[12px] font-semibold ${p.tone}`}>{p.text}</span>
            <span className="min-w-0 text-[13px] text-neutral-100">{p.name}<small className="block truncate text-[11.5px] text-neutral-500">{p.hint}</small></span>
          </button>
        ))}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button loading={busy} onClick={onConnect}>Continuar</Button>
      </div>
    </Modal>
  );
}
