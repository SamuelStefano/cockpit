import { Icon } from '../../../components/primitives';
import { Card, Pill } from '../atoms';

const SCOPE = [
  'React', 'Badge', 'Button', 'CodeBlock', 'ConnDot', 'EmptyState', 'Icon', 'Input', 'Markdown',
  'Modal', 'ProgressBar', 'RouteHeader', 'Skeleton', 'SkeletonCards', 'Stat', 'Tabs',
  'fireConfetti', 'toast', 'tokens',
] as const;

const CENARIOS = [
  'Botões', 'Badges & status', 'Formulário', 'Modal', 'Tabs', 'Vazio & carregando',
  'Métricas', 'Toast & confetti', 'Ícones', 'Estresse',
] as const;

export function PlaygroundScope() {
  return (
    <div className="mt-3 space-y-3">
      <Card className="border-orange-500/20">
        <div className="mb-2 flex items-center gap-2">
          <Icon name="tag" size={15} className="text-orange-300" />
          <h3 className="text-[14px] font-semibold text-neutral-100">O que já vem em escopo</h3>
        </div>
        <p className="mb-3 text-[13px] leading-relaxed text-neutral-400">
          Você não escreve <span className="font-medium text-neutral-300">import</span> nenhum: os primitivos do design system chegam prontos.
          O código só precisa terminar com <Pill>export default function App() {'{ … }'}</Pill>.
          Um botão de etiqueta na barra do estúdio lista tudo que está em escopo:
        </p>
        <div className="flex flex-wrap gap-1.5">
          {SCOPE.map((n) => (
            <code key={n} className="rounded-md border border-neutral-700/60 bg-neutral-950 px-1.5 py-0.5 font-mono text-[11px] text-neutral-300">{n}</code>
          ))}
        </div>
      </Card>
      <Card>
        <div className="mb-2 flex items-center gap-2">
          <Icon name="grip" size={15} className="text-violet-300" />
          <h3 className="text-[14px] font-semibold text-neutral-100">Dez cenários prontos</h3>
        </div>
        <p className="mb-3 text-[13px] leading-relaxed text-neutral-400">
          Cada aba abre um cenário pronto pra editar. Eles forçam casos-limite de propósito — texto longo, muitas abas,
          lista de 200 itens, valores extremos — porque é aí que o bug de UI aparece.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {CENARIOS.map((c) => (
            <span key={c} className="rounded-md border border-neutral-800 bg-neutral-900/60 px-2 py-0.5 text-[11.5px] text-neutral-400">{c}</span>
          ))}
        </div>
      </Card>
    </div>
  );
}
