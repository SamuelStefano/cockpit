import { Badge, RadioCardGroup, type RadioCardItem } from '../primitives';
import type { InstallMode } from './pairing';

const ITEMS: RadioCardItem<InstallMode>[] = [
  {
    id: 'isolated', icon: 'shield', title: 'Isolado (usuário deck)',
    description: 'Recomendado pra testar. O agente roda como o usuário deck, sem sudo: não altera a sua conta, o seu Node nem os seus pacotes.',
    badge: <Badge tone="orange">recomendado</Badge>,
  },
  {
    id: 'dedicated', icon: 'terminal', title: 'Seu usuário (VPS dedicada)',
    description: 'O agente roda como você e alcança tudo que a sua conta alcança. Só pra uma VPS dedicada ao Deck.',
  },
];

export function InstallModePicker({ mode, onChange }: { mode: InstallMode; onChange: (m: InstallMode) => void }) {
  return <RadioCardGroup label="modo de instalação" items={ITEMS} value={mode} onChange={onChange} />;
}
