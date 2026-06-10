import { useState, useEffect, useMemo, useRef } from 'react';
import { Icon, Badge, SkeletonCards } from '../components/primitives';
import type { SkillMeta } from '../../shared/protocol';
import type { SkillDoc } from '../useCockpit';
import { SkillCard } from './skills/SkillCard';
import { SkillModal } from './skills/SkillModal';
import { SkillsOffline } from './skills/SkillsOffline';
import { SkillsEmpty } from './skills/SkillsEmpty';

interface Props {
  connected: boolean;
  skills: SkillMeta[];
  loaded: boolean;
  openSkill: SkillDoc | null;
  onSkillList: () => void;
  onSkillOpen: (id: string) => void;
  onSkillClose: () => void;
}

export function Skills({ connected, skills, loaded, openSkill, onSkillList, onSkillOpen, onSkillClose }: Props) {
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (connected) onSkillList(); }, [connected, onSkillList]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
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
    const matched = q ? skills.filter((s) => (s.name + ' ' + s.description).toLowerCase().includes(q)) : skills;
    return [...matched].sort((a, b) => b.mtime - a.mtime);
  }, [skills, query]);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-neutral-950">
      <div className="shrink-0 border-b border-neutral-800/80 px-4 py-3">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[14px] font-semibold lowercase tracking-tight text-neutral-100">skills</span>
            <Badge tone="neutral">{skills.length}</Badge>
          </div>
          <div className="flex w-full items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 focus-within:border-neutral-700 focus-within:ring-2 focus-within:ring-orange-500/15 sm:max-w-sm">
            <Icon name="search" size={14} className="shrink-0 text-neutral-500" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar skills…"
              className="w-full bg-transparent text-[12.5px] text-neutral-200 placeholder-neutral-600 outline-none"
            />
            <kbd className="hidden shrink-0 rounded border border-neutral-700 bg-neutral-950 px-1 py-px font-mono text-[9px] text-neutral-500 sm:block">⌘/</kbd>
          </div>
        </div>
      </div>

      {!connected ? (
        <SkillsOffline />
      ) : (
        <div className="scroll-thin flex-1 overflow-y-auto p-4">
          {!loaded ? (
            <SkeletonCards />
          ) : filtered.length === 0 ? (
            <SkillsEmpty query={query} />
          ) : (
            <div className="stagger-fade grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((s) => <SkillCard key={s.id} s={s} onClick={() => onSkillOpen(s.id)} />)}
            </div>
          )}
        </div>
      )}

      {openSkill && <SkillModal doc={openSkill} onClose={onSkillClose} />}
    </div>
  );
}
