import { useState, useEffect, useMemo, useRef } from 'react';
import { Icon, Badge, Markdown } from '../components/primitives';
import { download } from '../lib/export';
import type { SkillMeta } from '../../shared/protocol';
import type { SkillDoc } from '../useCockpit';

function Card({ s, onClick }: { s: SkillMeta; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group relative flex flex-col rounded-xl border border-neutral-800 bg-neutral-900/40 p-3.5 text-left transition hover:-translate-y-px hover:border-orange-500/40 hover:bg-orange-500/[0.05] hover:shadow-lg hover:shadow-black/30"
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5">
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-orange-500/15 text-orange-400">
            <Icon name="sparkles" size={12} />
          </span>
          <Badge tone="neutral">skill</Badge>
        </span>
      </div>
      <h3 className="mb-1 line-clamp-1 font-mono text-[13px] font-medium lowercase text-neutral-200 group-hover:text-orange-300">{s.name}</h3>
      <p className="line-clamp-3 text-[12px] leading-snug text-neutral-500">{s.description || '—'}</p>
    </button>
  );
}

function ExportBtn({ label, icon, onClick }: { label: string; icon: 'copy' | 'download'; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={label}
      className="flex items-center gap-1 rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1 text-[11px] font-medium text-neutral-400 transition hover:border-orange-500/40 hover:text-orange-300"
    >
      <Icon name={icon} size={12} /> {label}
    </button>
  );
}

function SkillModal({ doc, onClose }: { doc: SkillDoc; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const copy = () => {
    navigator.clipboard.writeText(doc.body).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="fade-up relative flex max-h-[85vh] w-full max-w-3xl flex-col rounded-xl border border-neutral-800 bg-neutral-950 shadow-2xl"
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-neutral-800 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate font-mono text-[13px] font-semibold lowercase text-neutral-200">{doc.name}</span>
            <Badge tone="neutral">skill</Badge>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <ExportBtn label={copied ? 'copiado!' : 'copiar'} icon="copy" onClick={copy} />
            <ExportBtn label=".md" icon="download" onClick={() => download(`${doc.id}.md`, 'text/markdown', doc.body)} />
            <ExportBtn label=".json" icon="download" onClick={() => download(`${doc.id}.json`, 'application/json', JSON.stringify({ id: doc.id, name: doc.name, body: doc.body }, null, 2))} />
            <button onClick={onClose} className="rounded-md p-1 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200">
              <Icon name="x" size={16} />
            </button>
          </div>
        </div>
        <div className="scroll-thin overflow-y-auto px-5 py-4 text-[13px] leading-relaxed text-neutral-300">
          <div className="max-w-prose"><Markdown md={doc.body} /></div>
        </div>
      </div>
    </div>
  );
}

function Offline() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-neutral-800 bg-neutral-900 text-neutral-600">
        <Icon name="circle" size={20} />
      </div>
      <p className="text-[13px] font-medium text-neutral-300">Backend local indisponível</p>
      <p className="mt-1 max-w-sm text-[12px] leading-snug text-neutral-600">
        As skills vivem na sua máquina (<span className="font-mono">~/.claude/skills/</span>) e só aparecem com o backend do
        cockpit rodando em <span className="font-mono">127.0.0.1</span>.
      </p>
    </div>
  );
}

function Empty({ query }: { query: string }) {
  return (
    <div className="mt-16 flex flex-col items-center px-4 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-neutral-800 bg-neutral-900 text-neutral-600">
        <Icon name="sparkles" size={18} />
      </div>
      <p className="text-[12.5px] font-medium text-neutral-400">{query ? 'Nada encontrado' : 'Nenhuma skill ainda'}</p>
      <p className="mt-1 text-[11.5px] leading-snug text-neutral-600">
        {query ? <>Nada para «{query}»</> : 'As skills do agente aparecem aqui assim que forem criadas.'}
      </p>
    </div>
  );
}

interface Props {
  connected: boolean;
  skills: SkillMeta[];
  openSkill: SkillDoc | null;
  onSkillList: () => void;
  onSkillOpen: (id: string) => void;
  onSkillClose: () => void;
}

export function Skills({ connected, skills, openSkill, onSkillList, onSkillOpen, onSkillClose }: Props) {
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (connected) onSkillList(); }, [connected, onSkillList]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return skills;
    return skills.filter((s) => (s.name + ' ' + s.description).toLowerCase().includes(q));
  }, [skills, query]);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-neutral-950">
      <div className="shrink-0 border-b border-neutral-800/80 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[14px] font-semibold lowercase tracking-tight text-neutral-100">skills</span>
            <Badge tone="neutral">{skills.length}</Badge>
          </div>
          <div className="flex w-full max-w-sm items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 focus-within:border-neutral-700 focus-within:ring-2 focus-within:ring-orange-500/15">
            <Icon name="search" size={14} className="shrink-0 text-neutral-500" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar skills…"
              className="w-full bg-transparent text-[12.5px] text-neutral-200 placeholder-neutral-600 outline-none"
            />
            <kbd className="hidden shrink-0 rounded border border-neutral-700 bg-neutral-950 px-1 py-px font-mono text-[9px] text-neutral-500 sm:block">⌘K</kbd>
          </div>
        </div>
      </div>

      {!connected ? (
        <Offline />
      ) : (
        <div className="scroll-thin flex-1 overflow-y-auto p-4">
          {filtered.length === 0 ? (
            <Empty query={query} />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((s) => <Card key={s.id} s={s} onClick={() => onSkillOpen(s.id)} />)}
            </div>
          )}
        </div>
      )}

      {openSkill && <SkillModal doc={openSkill} onClose={onSkillClose} />}
    </div>
  );
}
