import { Icon, type IconName } from '../components/primitives';

const FLOW: { icon: IconName; label: string }[] = [
  { icon: 'download', label: 'Instalar' },
  { icon: 'user', label: 'Entrar' },
  { icon: 'play', label: 'Testar' },
];

export function AgentFlow({ done }: { done: number }) {
  return (
    <ol className="flex items-center gap-1.5 text-[12px]">
      {FLOW.map((f, i) => {
        const finished = i < done;
        const current = i === done;
        return (
          <li key={f.label} className="flex items-center gap-1.5">
            {i > 0 && <Icon name="chevronRight" size={12} className="text-neutral-700" />}
            <span className={`flex items-center gap-1.5 ${finished ? 'text-green-400/80' : current ? 'text-orange-300/90' : 'text-neutral-500'}`}>
              <Icon name={finished ? 'check' : f.icon} size={12} />
              {f.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
