import { Icon } from '../primitives';

export function BetaNote() {
  return (
    <p className="mt-6 flex gap-2 text-[12px] leading-relaxed text-neutral-600">
      <Icon name="alertTriangle" size={12} className="mt-0.5 shrink-0" />
      <span>
        <span className="font-medium text-neutral-500">O que passa pelo relay.</span> O relay da DevFellowship encaminha suas mensagens até o seu servidor.
        Com o aparelho cadastrado e o canal selado ligado (o padrão), o conteúdo vai cifrado entre o app e o seu servidor: o relay vê a conta, o horário e o tamanho das mensagens, e pode derrubar a conexão.
        Se o seu servidor roda com o canal selado desligado, o relay vê o tráfego em claro. Seus prompts seguem do seu servidor para o provedor de IA do agente.
      </span>
    </p>
  );
}
