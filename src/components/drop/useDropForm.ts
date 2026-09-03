import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import type { DropApi } from '../../cockpit/useDrops';
import { slugFromName } from './drop-format';

// Mesma regra do server/drop.ts. Validar aqui é UX (erro na hora, sem round-trip);
// a validação que vale é a do servidor.
const SLUG_RE = /^[a-zA-Z0-9._-]{1,64}$/;
const MAX_BYTES = 1_000_000;

export const TTL_OPCOES = [
  { label: 'sem prazo', ms: 0 },
  { label: '1 hora', ms: 3_600_000 },
  { label: '24 horas', ms: 86_400_000 },
  { label: '7 dias', ms: 604_800_000 },
] as const;

export function useDropForm(api: DropApi, open: boolean) {
  const [slug, setSlug] = useState('');
  const [content, setContent] = useState('');
  const [ttlMs, setTtlMs] = useState(0);
  const [erro, setErro] = useState('');
  const [enviado, setEnviado] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (open) api.onDropList(); }, [open, api]);

  const onFile = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > MAX_BYTES) { setErro('arquivo grande demais (máx. 1 MB)'); return; }
    f.text().then((txt) => {
      setContent(txt);
      setSlug((s) => s || slugFromName(f.name));
      setErro('');
    }).catch(() => setErro('não deu pra ler o arquivo'));
  }, []);

  const submit = useCallback(() => {
    const nome = slug.trim();
    if (!SLUG_RE.test(nome) || nome.startsWith('.')) { setErro('nome: letras, números, . _ - (até 64, sem começar com ponto)'); return; }
    if (!content) { setErro('sem conteúdo pra gravar'); return; }
    if (new Blob([content]).size > MAX_BYTES) { setErro('conteúdo grande demais (máx. 1 MB)'); return; }
    api.onDropPut(nome, content, ttlMs || undefined);
    setEnviado(nome);
    setErro('');
    // Limpa o segredo do estado do React assim que o frame sai: deixá-lo no
    // textarea o mantém vivo em memória/devtools por toda a sessão da aba.
    setContent('');
    setSlug('');
  }, [api, slug, content, ttlMs]);

  // A referência só aparece quando é do put que ACABOU de sair — sem isso o
  // lastDrop de um envio anterior fingiria sucesso de um envio que falhou.
  const ref = enviado && api.lastDrop?.slug === enviado ? api.lastDrop : null;

  return { slug, setSlug, content, setContent, ttlMs, setTtlMs, erro, fileRef, onFile, submit, ref };
}
