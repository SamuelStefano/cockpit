import { useCallback, useState } from 'react';
import type { ClientMsg, ServerMsg, SkillMeta } from '../../shared/protocol';

export interface SkillDoc { id: string; name: string; body: string }

export interface Skills {
  skills: SkillMeta[];
  skillsLoaded: boolean;
  openSkill: SkillDoc | null;
  onSkillList: () => void;
  onSkillOpen: (id: string) => void;
  onSkillClose: () => void;
  onMsg: (msg: ServerMsg) => boolean;
}

export function useSkills(send: (m: ClientMsg) => boolean): Skills {
  const [skills, setSkills] = useState<SkillMeta[]>([]);
  const [skillsLoaded, setSkillsLoaded] = useState(false);
  const [openSkill, setOpenSkill] = useState<SkillDoc | null>(null);

  const onMsg = useCallback((msg: ServerMsg) => {
    switch (msg.t) {
      case 'skills':
        setSkills(msg.items);
        setSkillsLoaded(true);
        return true;
      case 'skill':
        setOpenSkill({ id: msg.id, name: msg.name, body: msg.body });
        return true;
      default:
        return false;
    }
  }, []);

  return {
    skills,
    skillsLoaded,
    openSkill,
    onSkillList: useCallback(() => { send({ t: 'skill-list' }); }, [send]),
    onSkillOpen: useCallback((id: string) => { send({ t: 'skill-open', id }); }, [send]),
    onSkillClose: useCallback(() => setOpenSkill(null), []),
    onMsg,
  };
}
