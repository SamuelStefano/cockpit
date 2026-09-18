import { useCallback, useRef, useState } from 'react';
import type { ClientMsg, RegistryCatalog, RegistryRef, ServerMsg, SkillMeta } from '../../shared/protocol';
import { toast } from '../components/primitives/toast-bus';

export interface SkillDoc { id: string; name: string; body: string }

export interface Skills {
  skills: SkillMeta[];
  skillsLoaded: boolean;
  openSkill: SkillDoc | null;
  registry: RegistryCatalog | null;
  registryLoading: boolean;
  registryError: string | null;
  installing: ReadonlySet<string>;
  onSkillList: () => void;
  onSkillOpen: (id: string) => void;
  onSkillClose: () => void;
  onRegistryGet: (refresh?: boolean) => void;
  onRegistryInstall: (key: string, items: RegistryRef[]) => void;
  onMsg: (msg: ServerMsg) => boolean;
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function useSkills(send: (m: ClientMsg) => boolean): Skills {
  const [skills, setSkills] = useState<SkillMeta[]>([]);
  const [skillsLoaded, setSkillsLoaded] = useState(false);
  const [openSkill, setOpenSkill] = useState<SkillDoc | null>(null);
  const [registry, setRegistry] = useState<RegistryCatalog | null>(null);
  const [registryLoading, setRegistryLoading] = useState(false);
  const [registryError, setRegistryError] = useState<string | null>(null);
  const [installing, setInstalling] = useState<ReadonlySet<string>>(new Set());
  // reqId -> the UI key (pack or skill) whose button shows the spinner.
  const pending = useRef(new Map<string, string>());

  const onMsg = useCallback((msg: ServerMsg) => {
    switch (msg.t) {
      case 'skills':
        setSkills(msg.items);
        setSkillsLoaded(true);
        return true;
      case 'skill':
        setOpenSkill({ id: msg.id, name: msg.name, body: msg.body });
        return true;
      case 'registry':
        setRegistryLoading(false);
        if (msg.catalog) { setRegistry(msg.catalog); setRegistryError(null); }
        else setRegistryError(msg.error ?? 'registro indisponível');
        return true;
      case 'registry-install-result': {
        const key = pending.current.get(msg.reqId);
        pending.current.delete(msg.reqId);
        if (key) setInstalling((prev) => { const next = new Set(prev); next.delete(key); return next; });
        if (msg.ok) {
          toast(msg.installed.length ? `${plural(msg.installed.length, 'skill instalada', 'skills instaladas')}` : 'Nada novo: já estava instalado');
        } else {
          toast(`Falha ao instalar: ${msg.error ?? 'erro'}`, { tone: 'error' });
        }
        return true;
      }
      default:
        return false;
    }
  }, []);

  const onRegistryGet = useCallback((refresh?: boolean) => {
    setRegistryLoading(true);
    send({ t: 'registry-get', refresh });
  }, [send]);

  const onRegistryInstall = useCallback((key: string, items: RegistryRef[]) => {
    if (!items.length) return;
    const reqId = `${key}:${Date.now()}`;
    pending.current.set(reqId, key);
    setInstalling((prev) => new Set(prev).add(key));
    if (!send({ t: 'registry-install', reqId, items })) {
      pending.current.delete(reqId);
      setInstalling((prev) => { const next = new Set(prev); next.delete(key); return next; });
      toast('Sem conexão com o servidor', { tone: 'error' });
    }
  }, [send]);

  return {
    skills,
    skillsLoaded,
    openSkill,
    registry,
    registryLoading,
    registryError,
    installing,
    onSkillList: useCallback(() => { send({ t: 'skill-list' }); }, [send]),
    onSkillOpen: useCallback((id: string) => { send({ t: 'skill-open', id }); }, [send]),
    onSkillClose: useCallback(() => setOpenSkill(null), []),
    onRegistryGet,
    onRegistryInstall,
    onMsg,
  };
}
