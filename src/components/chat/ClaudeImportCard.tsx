import { useState } from 'react';
import type { ImportKind } from '../../../shared/claude-import';
import type { ClaudeImportApi } from '../../cockpit/useClaudeImport';
import { Button, Checkbox, Input } from '../primitives';

const KIND_LABEL: Record<ImportKind, string> = {
  memory: 'Importe seu contexto',
  skills: 'Importe seus skills',
  mcps: 'Importe seus MCPs',
};
const KINDS: ImportKind[] = ['memory', 'skills', 'mcps'];

export function ClaudeImportCard({ api }: { api: ClaudeImportApi }) {
  const { scan, hint, result, busy, onScan, onApply } = api;
  const [kinds, setKinds] = useState<ImportKind[]>(KINDS);
  const [path, setPath] = useState('');
  const toggle = (k: ImportKind) => setKinds((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]));
  const fresh = (k: ImportKind) => {
    if (!scan?.found) return 0;
    if (k === 'skills') return scan.skills.filter((s) => !s.exists).length;
    if (k === 'mcps') return scan.mcps.filter((m) => !m.exists).length;
    return scan.memory.filter((m) => !m.exists).length;
  };
  const total = kinds.reduce((n, k) => n + fresh(k), 0);

  return (
    <div className="mt-3 rounded-xl border border-neutral-800 bg-neutral-950 p-3">
      <p className="text-[13.5px] font-semibold text-neutral-100">Importar do seu Claude</p>
      <p className="mt-1 text-[12px] leading-relaxed text-neutral-400">
        Copia contexto, skills e MCPs de um .claude existente. Nomes que já existem são pulados e segredos nunca são copiados.
      </p>
      <div className="mt-2 flex flex-col gap-1.5">
        {KINDS.map((k) => (
          <label key={k} className="flex items-center gap-2 text-[12.5px] text-neutral-200">
            <Checkbox checked={kinds.includes(k)} onChange={() => toggle(k)} label={KIND_LABEL[k]} />
            {KIND_LABEL[k]}
            {scan?.found && <span className="ml-auto text-neutral-500">{fresh(k)} novos</span>}
          </label>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <Input mono value={path} onChange={(e) => setPath(e.target.value)} placeholder="~/.claude (ou cole o caminho)" aria-label="Caminho do .claude" />
        <Button variant="ghost" size="sm" disabled={busy} onClick={() => onScan(path)}>Pré-visualizar</Button>
      </div>
      {scan && !scan.found && (
        <div className="mt-2 text-[12px] leading-relaxed text-neutral-400">
          {scan.reason === 'unreadable' ? (
            <>
              <p>O Deck roda como um usuário isolado e não consegue ler essa pasta. Copie para um lugar legível rodando no terminal e depois cole <code>$HOME/claude-import/.claude</code> acima:</p>
              {hint && <pre className="mt-1 overflow-x-auto rounded-md bg-neutral-900 p-2 text-[11.5px] text-neutral-200">{hint}</pre>}
            </>
          ) : (
            <p>{scan.reason === 'not-found' ? 'Pasta não encontrada.' : 'Caminho inválido.'}</p>
          )}
        </div>
      )}
      {scan?.found && (
        <div className="mt-2 text-[12px] leading-relaxed text-neutral-400">
          {scan.reason === 'same-as-target' && <p>Essa é a pasta do próprio Deck; nada a importar dela.</p>}
          {scan.mcps.filter((m) => m.needsFill.length > 0 && !m.exists).map((m) => (
            <p key={m.name}>MCP {m.name}: precisa preencher {m.needsFill.join(', ')}</p>
          ))}
          <div className="mt-2 flex justify-end">
            <Button size="sm" disabled={busy || total === 0 || scan.reason === 'same-as-target'} onClick={() => onApply(kinds, path)}>
              Importar {total} {total === 1 ? 'item' : 'itens'}
            </Button>
          </div>
        </div>
      )}
      {result && (
        <div className="mt-2 text-[12px] leading-relaxed text-neutral-300">
          <p>
            Copiado: {result.copied.memory.length + result.copied.skills.length + result.copied.mcps.length} · pulado: {result.skipped.length}
          </p>
          {result.needsFill.map((n) => <p key={n.mcp}>Precisa preencher em {n.mcp}: {n.keys.join(', ')}</p>)}
          {result.errors.map((e) => <p key={e} className="text-red-400">{e}</p>)}
        </div>
      )}
    </div>
  );
}
