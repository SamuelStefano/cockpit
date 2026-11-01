import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import type { DropApi } from '../../cockpit/useDrops';
import { classifyBytes, slugFromName, type DropPayload } from './drop-format';

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
  // Picked file: only name + size live in state (the form shows these). The payload
  // sits in a ref, never rendered, and is dropped as soon as the frame leaves.
  const [file, setFile] = useState<{ name: string; bytes: number; binary: boolean } | null>(null);
  const payloadRef = useRef<DropPayload | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pending = useRef<{ slug: string; bytes: number; binary: boolean } | null>(null);

  // Só a callback nas deps: o `api` ganha identidade nova a cada frame `drops`, e
  // pedir a lista de novo por isso virava um laço infinito de drop-list enquanto o
  // modal estivesse aberto.
  const { onDropList } = api;
  useEffect(() => { if (open) onDropList(); }, [open, onDropList]);

  const onFile = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > MAX_BYTES) { setErro('arquivo grande demais (máx. 1 MB)'); return; }
    f.arrayBuffer().then((buf) => {
      const payload = classifyBytes(new Uint8Array(buf));
      payloadRef.current = payload;
      setFile({ name: f.name, bytes: payload.bytes, binary: payload.encoding === 'base64' });
      setContent('');
      setSlug(slugFromName(f.name));
      setErro('');
    }).catch(() => setErro('não deu pra ler o arquivo'));
  }, []);

  const clearFile = useCallback(() => { payloadRef.current = null; setFile(null); }, []);

  const submit = useCallback(() => {
    const nome = slug.trim();
    if (!SLUG_RE.test(nome) || nome.startsWith('.')) { setErro('nome: letras, números, . _ - (até 64, sem começar com ponto)'); return; }
    const payload: DropPayload | null = payloadRef.current ?? (content ? { content, bytes: new Blob([content]).size } : null);
    if (!payload) { setErro('sem conteúdo pra gravar'); return; }
    if (payload.bytes > MAX_BYTES) { setErro('conteúdo grande demais (máx. 1 MB)'); return; }
    // Sem confirmar que o frame saiu, o segredo era apagado do textarea e nada tinha
    // sido gravado — o usuário tinha que ir buscar o token de novo.
    if (!api.onDropPut(nome, payload.content, ttlMs || undefined, payload.encoding)) { setErro('sem conexão — nada foi gravado'); return; }
    pending.current = { slug: nome, bytes: payload.bytes, binary: payload.encoding === 'base64' };
    setEnviado(nome);
    setErro('');
    // Limpa o segredo do estado do React assim que o frame sai: deixá-lo no
    // textarea o mantém vivo em memória/devtools por toda a sessão da aba.
    setContent('');
    setSlug('');
    clearFile();
  }, [api, clearFile, slug, content, ttlMs]);

  // A referência só aparece quando é do put que ACABOU de sair — sem isso o
  // lastDrop de um envio anterior fingiria sucesso de um envio que falhou.
  const ref = enviado && api.lastDrop?.slug === enviado ? api.lastDrop : null;

  // Recusa do servidor volta como frame de erro genérico, sem `drop`: sem este prazo
  // o formulário ficava calado pra sempre, como se tivesse gravado.
  useEffect(() => {
    if (!enviado || ref) return;
    const t = setTimeout(() => setErro(`sem confirmação do servidor pra "${enviado}" — confira a lista`), 8000);
    return () => clearTimeout(t);
  }, [enviado, ref]);

  // An agent that predates binary drops ignores `encoding` and saves the base64 TEXT:
  // the ref then reports ~4/3 of the real size. Catch it, remove the bad file, say so.
  const { onDropRm } = api;
  const mismatch = !!ref && !!pending.current && pending.current.binary && ref.bytes !== pending.current.bytes;
  useEffect(() => {
    if (!mismatch || !ref) return;
    onDropRm(ref.slug);
    pending.current = null;
    setEnviado('');
    setErro('o agente nesta box é antigo e gravaria o binário como texto — removi o arquivo. Atualize o agente e envie de novo.');
  }, [mismatch, ref, onDropRm]);

  return { file, clearFile, slug, setSlug, content, setContent, ttlMs, setTtlMs, erro, fileRef, onFile, submit, ref: mismatch ? null : ref };
}
