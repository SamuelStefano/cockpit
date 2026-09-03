import { SectionTitle, InfoCard, Callout, Pill } from '../atoms';

export function Drop() {
  return (
    <section id="drop" className="mb-14 scroll-mt-6">
      <SectionTitle icon="shield" kicker="segredos" title="Drop privado"
        desc="Entrega um token, um .env ou um script de deploy direto na box do agente sem que o conteúdo passe pelo chat. Fica no menu de perfil, é admin-only e a resposta é só a referência: caminho, tamanho e sha256." />
      <div className="grid gap-3 sm:grid-cols-3">
        <InfoCard icon="message" title="Por que não colar no chat">
          O texto do chat vira linha no JSONL da sessão e é reenviado ao modelo a cada turno e a cada compactação —
          um segredo colado uma vez volta centenas de vezes.
        </InfoCard>
        <InfoCard icon="paperclip" title="Por que não anexar">
          O anexo é espelhado no S3 compartilhado e o texto extraído entra no prompt. É a pior via possível pra segredo.
        </InfoCard>
        <InfoCard icon="file" title="Por que não usar Notas">
          A nota é rascunho pra virar prompt: no "Analisar com IA" o conteúdo inteiro vai pro modelo.
        </InfoCard>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <InfoCard icon="shield" title="O que o drop faz">
          Grava em <Pill>~/.deck-drop/&lt;nome&gt;</Pill> com arquivo <Pill>0600</Pill> em diretório <Pill>0700</Pill>.
          Não passa pelo pipeline de anexo, não sobe pro S3 e nenhuma resposta devolve o conteúdo — só a referência,
          com um botão pra copiar o caminho. Dá pra pôr prazo (1h/24h/7d): o expirado some da lista e do disco.
        </InfoCard>
        <InfoCard icon="terminal" title="Como pedir o consumo">
          Mande o CAMINHO, não o segredo: "leia <Pill>~/.deck-drop/deploy.env</Pill> e registre cada chave com
          admin-env-set", "importe esse arquivo no Infisical", "rode esse script". O agente usa o arquivo como
          entrada de um comando; o conteúdo nunca precisa aparecer na resposta.
        </InfoCard>
      </div>
      <Callout icon="shield" tone="amber">
        <span className="font-medium">O drop tira o segredo do transcript, não do contexto ·</span> se o agente
        der <Pill>Read</Pill> no arquivo, o conteúdo entra na janela e volta pro JSONL como qualquer outro texto.
        A recomendação é <span className="font-medium">consumir sem imprimir</span> — o arquivo alimenta
        <Pill>admin-env-set</Pill>/<Pill>env.json</Pill>, é importado no Infisical ou é executado por um script.
        O <Pill>drop-open</Pill> (devolver o conteúdo) é último recurso.
      </Callout>
      <Callout icon="zap" tone="sky">
        <span className="font-medium">Fora do loopback ·</span> o conteúdo ainda cruza o WebSocket, e no acesso
        remoto o relay é operado pela DevFellowship (trusted-relay beta). O drop resolve a persistência do segredo
        no transcript; pra segredo de produção, o caminho continua sendo o cofre.
      </Callout>
    </section>
  );
}
