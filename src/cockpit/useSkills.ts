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

// An older server does not know `registry-get` and never answers; without a
// deadline the Packs tab would show a skeleton forever.
const REGISTRY_TIMEOUT_MS = 25_000;
// Um socket que cai no meio da instalação nunca traz o resultado, e o botão ficava
// em "instalando…" até o F5.
const INSTALL_TIMEOUT_MS = 120_000;

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
  // The skill the user last asked to open; a reply for anything else (closed, or
  // superseded by a later click) must not pop the modal back up.
  const wantedSkill = useRef<string | null>(null);
  const registryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const installTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const onMsg = useCallback((msg: ServerMsg) => {
    switch (msg.t) {
      case 'skills':
        setSkills(msg.items);
        setSkillsLoaded(true);
        return true;
      case 'skill':
        if (msg.id === wantedSkill.current) setOpenSkill({ id: msg.id, name: msg.name, body: msg.body });
        return true;
      case 'registry':
        if (registryTimer.current) clearTimeout(registryTimer.current);
        setRegistryLoading(false);
        if (msg.catalog) { setRegistry(msg.catalog); setRegistryError(null); }
        else setRegistryError(msg.error ?? 'registro indisponível');
        return true;
      case 'registry-install-result': {
        const key = pending.current.get(msg.reqId);
        pending.current.delete(msg.reqId);
        const timer = installTimers.current.get(msg.reqId);
        if (timer) { clearTimeout(timer); installTimers.current.delete(msg.reqId); }
        if (key) setInstalling((prev) => { const next = new Set(prev); next.delete(key); return next; });
        if (msg.ok) {
          toast(msg.installed.length ? `${plural(msg.installed.length, 'skill instalada', 'skills instaladas')}` : 'Nada novo: já estava instalado');
        } else {
          // Instalação parcial contada como falha pura fazia o usuário reinstalar o
          // pacote inteiro achando que nada tinha entrado.
          const parcial = msg.installed.length ? `${plural(msg.installed.length, 'skill instalada', 'skills instaladas')}, mas ` : '';
          toast(`${parcial}falhou: ${msg.error ?? 'erro'}`, { tone: 'error' });
        }
        return true;
      }
      default:
        return false;
    }
  }, []);

  const onRegistryGet = useCallback((refresh?: boolean) => {
    setRegistryLoading(true);
    setRegistryError(null);
    if (registryTimer.current) clearTimeout(registryTimer.current);
    registryTimer.current = setTimeout(() => {
      setRegistryLoading(false);
      setRegistryError('O servidor não respondeu. Se o Deck acabou de atualizar, ele reinicia sozinho quando ficar ocioso.');
    }, REGISTRY_TIMEOUT_MS);
    if (!send({ t: 'registry-get', refresh })) {
      clearTimeout(registryTimer.current);
      setRegistryLoading(false);
      setRegistryError('Sem conexão com o servidor.');
    }
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
      return;
    }
    installTimers.current.set(reqId, setTimeout(() => {
      installTimers.current.delete(reqId);
      if (!pending.current.delete(reqId)) return;
      setInstalling((prev) => { const next = new Set(prev); next.delete(key); return next; });
      toast('A instalação não respondeu — recarregue o registro pra conferir o que entrou', { tone: 'error' });
    }, INSTALL_TIMEOUT_MS));
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
    onSkillOpen: useCallback((id: string) => { wantedSkill.current = id; send({ t: 'skill-open', id }); }, [send]),
    onSkillClose: useCallback(() => { wantedSkill.current = null; setOpenSkill(null); }, []),
    onRegistryGet,
    onRegistryInstall,
    onMsg,
  };
}
