import { Button, Input } from '../primitives';
import { DropRefCard } from './DropRefCard';
import { TTL_OPCOES, useDropForm } from './useDropForm';
import type { DropApi } from '../../cockpit/useDrops';

// Formulário do drop: cola o texto ou escolhe um arquivo, dá um nome e grava. O
// conteúdo sai do estado assim que o frame parte (ver useDropForm).
export function DropForm({ api, open }: { api: DropApi; open: boolean }) {
  const f = useDropForm(api, open);

  return (
    <div>
      <textarea
        value={f.content}
        onChange={(e) => f.setContent(e.target.value)}
        rows={5}
        spellCheck={false}
        placeholder={'TOKEN=...\nou cole o script inteiro'}
        aria-label="Conteúdo do drop"
        className="w-full resize-y rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 font-mono text-[12px] text-neutral-200 placeholder:text-neutral-700 outline-hidden transition focus-within:border-orange-500/40"
      />
      <div className="mt-2 flex gap-2">
        <Button variant="outline" size="sm" icon="paperclip" className="grow" onClick={() => f.fileRef.current?.click()}>
          Escolher arquivo
        </Button>
        <input ref={f.fileRef} type="file" onChange={f.onFile} className="hidden" />
      </div>
      <label htmlFor="drop-slug" className="mt-3 block text-[11px] font-medium text-neutral-500">Nome do arquivo</label>
      <Input
        id="drop-slug"
        size="sm"
        mono
        className="mt-1"
        value={f.slug}
        maxLength={64}
        onChange={(e) => f.setSlug(e.target.value)}
        placeholder="deploy.env"
      />
      <div className="mt-2 flex flex-wrap gap-1.5">
        {TTL_OPCOES.map((o) => (
          <button
            key={o.ms}
            onClick={() => f.setTtlMs(o.ms)}
            className={`rounded-md border px-2 py-1 text-[11px] transition ${f.ttlMs === o.ms ? 'border-orange-500/40 bg-orange-500/15 text-orange-300' : 'border-neutral-800 text-neutral-500 hover:text-neutral-300'}`}
          >
            {o.label}
          </button>
        ))}
      </div>
      {f.erro && <p role="alert" className="mt-2 text-[11px] text-red-400">{f.erro}</p>}
      <Button size="sm" icon="shield" className="mt-3 w-full" onClick={f.submit}>
        Gravar na box do agente
      </Button>
      {f.ref && <DropRefCard dropRef={f.ref} />}
    </div>
  );
}
