import { Badge, RadioCardGroup, type RadioCardItem } from '../primitives';
import type { InstallMode } from './pairing';

const ITEMS: RadioCardItem<InstallMode>[] = [
  {
    id: 'isolated', icon: 'shield', title: 'isolado',
    description: 'Usuário deck separado, sem sudo. Não mexe na sua conta, Node nem pacotes.',
    badge: <Badge tone="orange">recomendado</Badge>,
  },
  {
    id: 'dedicated', icon: 'terminal', title: 'VPS dedicada',
    description: 'Instala no seu usuário. Pra uma VPS só do Deck.',
  },
];

export function InstallModePicker({ mode, onChange }: { mode: InstallMode; onChange: (m: InstallMode) => void }) {
  return <RadioCardGroup label="modo de instalação" items={ITEMS} value={mode} onChange={onChange} />;
}
