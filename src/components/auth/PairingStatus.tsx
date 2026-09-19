import { Badge, Button, Icon } from '../primitives';
import type { PairDiagnosis, RelayProbe } from './pairing';

interface PairingStatusProps {
  diagnosis: PairDiagnosis;
  probe: RelayProbe;
  onTest: () => void;
}

// Estado do pareamento com SAÍDA: o motivo do silêncio + o que rodar na VPS.
// Antes daqui a tela dizia só "aguardando o agente conectar…", sem nunca mudar.
export function PairingStatus({ diagnosis, probe, onTest }: PairingStatusProps) {
  return (
    <div className="mt-4 rounded-xl border border-neutral-800 bg-neutral-950/60 p-3">
      <div className="flex items-start gap-2">
        <Badge tone={diagnosis.tone} dot>{probe === 'checking' ? 'testando' : 'pareamento'}</Badge>
        <p className="flex-1 text-[11.5px] leading-relaxed text-neutral-400">{diagnosis.title}</p>
        <Button variant="outline" size="sm" disabled={probe === 'checking'} loading={probe === 'checking'} onClick={onTest}>
          testar conexão
        </Button>
      </div>
      {diagnosis.steps.length > 0 && (
        <ul className="mt-3 space-y-1.5 border-t border-neutral-800 pt-3">
          {diagnosis.steps.map((s) => (
            <li key={s} className="flex items-center gap-2">
              <Icon name="terminal" size={11} className="shrink-0 text-neutral-600" />
              <code className="overflow-x-auto whitespace-nowrap font-mono text-[11.5px] text-neutral-300">{s}</code>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
