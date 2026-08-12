import { SectionTitle, InfoCard } from '../atoms';

export function Profile() {
  return (
    <section id="perfil" className="mb-14 scroll-mt-6">
      <SectionTitle icon="user" kicker="personalização" title="Perfil & aparência"
        desc="O Deck é seu — dá pra dar cara a você e ao agente. Tudo fica salvo localmente no seu navegador (nada vai pro servidor) e o menu de perfil mora no canto direito do cabeçalho." />
      <div className="grid gap-3 sm:grid-cols-2">
        <InfoCard icon="user" title="Seu avatar e nome">
          Defina seu nome (usado nas iniciais do chat) e envie uma foto de avatar. A imagem é reduzida no próprio navegador
          e guardada localmente — sem upload pra lugar nenhum. Sem foto, o app usa suas iniciais.
        </InfoCard>
        <InfoCard icon="sparkles" iconClass="text-violet-300" title="Ícone da IA">
          Dentro do menu de perfil há um seletor escondido pro ícone do agente: o burst laranja da marca por padrão,
          ou um dos vários emojis divertidos (caranguejo, robô, alienígena, raposa…). Escolha um e ele passa a aparecer em todas as respostas.
        </InfoCard>
        <InfoCard icon="terminal" title="Mostrar ferramentas">
          Liga/desliga a caixa com o que o agente rodou no turno (Bash, Read, Grep…). Ligada, todas as ferramentas
          do turno viram uma caixa fechada só — a thread fica prompt + resposta e o caminho continua a um clique.
        </InfoCard>
        <InfoCard icon="sparkles" title="Agrupar notas do agente">
          Um turno longo narra o que vai fazer dezenas de vezes ("agora vou abrir a PR"). Com isso ligado esse bastidor
          sai das bolhas e vira uma caixa "N notas do agente"; só a resposta final fica solta. Texto com lista, título,
          código ou link nunca é tratado como nota, e o turno em andamento nunca é agrupado.
        </InfoCard>
      </div>
    </section>
  );
}
