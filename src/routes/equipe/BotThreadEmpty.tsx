import { EmptyState } from '../../components/primitives';

export function BotThreadEmpty({ name }: { name: string }) {
  return (
    <div className="flex h-full items-center justify-center">
      <EmptyState icon="message" title={`Fale com ${name}`} description="A conversa continua de onde parou. Mensagens trocadas com outros bots aparecem aqui também." />
    </div>
  );
}
