export const SETUP_SOURCE_URL = 'https://github.com/SamuelStefano/cockpit/blob/main/scripts/agent-setup.sh';

export const DRY_RUN_ENV = 'DECK_DRY_RUN=1';

export const COMMAND_DOES = [
  'Reaproveita o Node 22+ e o claude CLI que a VPS já tem; só baixa o que faltar, dentro do HOME (~/.deck-node, ~/.deck-npm).',
  'Clona o repositório em ~/.deck-src e instala as dependências com npm ci.',
  'Gera uma chave Ed25519 em ~/.deck-agent que fica nesta máquina e pareia o agente à sua conta com o código.',
  'Registra o serviço systemd deck-agent (sem systemd, sobe com nohup). O sudo é usado só nesse passo (e para instalar git ou curl, se faltarem).',
] as const;

export const COMMAND_DOES_NOT = [
  'Não troca o Node do sistema e não faz npm global.',
  'Watchdog, crons e hooks de git só entram se você pedir por variável (DECK_VPS_GUARD, DECK_EXTRAS, DECK_AUTO_REDEPLOY).',
] as const;

export const RELAY_SEES = [
  'Com o aparelho cadastrado e o canal selado ligado (o padrão do agente), o conteúdo do chat e dos anexos vai cifrado de ponta a ponta entre o app e a sua VPS; o relay não o lê.',
  'O relay vê metadados: a conta, o horário e o tamanho das mensagens, e pode derrubar a conexão.',
  'Se o agente roda com o canal selado desligado (DECK_E2E=off), o relay passa a ver o tráfego em claro.',
  'O relay é operado pela DevFellowship. Ele guarda a chave pública do seu agente e a conta a que ele pertence; a chave privada nunca sai da sua VPS. Cada conta só alcança o próprio agente.',
] as const;

export const RELAY_SOON = 'Seus prompts seguem da sua VPS para o provedor de IA do agente.';
