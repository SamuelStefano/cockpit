import { Button, Icon } from '../primitives';
import { useCopied } from '../../lib/useCopied';
import { fmtDropBytes, shortSha } from './drop-format';
import type { DropRef } from '../../../shared/protocol';

// Confirmação de um drop: SÓ a referência. Caminho, tamanho e sha256 curto provam
// que o arquivo chegou; o conteúdo não volta do servidor e não é renderizado.
export function DropRefCard({ dropRef }: { dropRef: DropRef }) {
  const [copiado, copiar, falhou] = useCopied();

  return (
    <div className="mt-3 rounded-lg border border-orange-500/25 bg-orange-500/[0.06] p-3">
      <div className="flex items-center gap-1.5 text-[11.5px] font-medium text-orange-300">
        <Icon name="check" size={13} />
        gravado na box do agente — o conteúdo não passou pelo chat
      </div>
      <code className="mt-2 block truncate font-mono text-[11.5px] text-neutral-300" title={dropRef.path}>{dropRef.path}</code>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10.5px] text-neutral-500">
        <span>{fmtDropBytes(dropRef.bytes)}</span>
        <span title={dropRef.sha256}>sha256 {shortSha(dropRef.sha256)}</span>
      </div>
      <Button
        variant="secondary"
        size="sm"
        icon={copiado ? 'check' : 'copy'}
        className="mt-2.5 w-full"
        onClick={() => copiar(dropRef.path)}
      >
        {copiado ? 'Caminho copiado' : falhou ? 'Não deu pra copiar' : 'Copiar caminho'}
      </Button>
    </div>
  );
}
