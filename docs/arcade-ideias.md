# Deck Arcade — backlog de ideias

O que já existe na primeira versão: nível e título, XP, sequência diária, 3 missões por dia, 26 conquistas (várias secretas), Bit Runner, 8 segredos, HUD na sidebar, tudo em `localStorage` por aparelho. Este arquivo lista o que ficou de fora.

Esforço: **P** = até 1 dia · **M** = 2 a 4 dias · **G** = mais de 1 semana ou toca servidor.

## Próximos 5 (recomendação)

1. **Sincronizar progresso por conta via account-prefs** (M): sem isso o XP do PC e o do celular divergem, e é a reclamação óbvia do uso real.
2. **Conquistas por dados reais do servidor** (M): "PR mergeado" e "turno barato" valem mais que "abriu a paleta"; o `usage-list` e o ledger de pontos já trafegam.
3. **Desafio semanal com meta de tokens** (P): reaproveita o motor de missões, só troca a janela de dia para semana.
4. **Cosméticos do Bit desbloqueados por nível** (M): é o que dá motivo para subir de nível depois do 10.
5. **Boss fight de CI vermelho** (M): transforma o momento mais chato do dia (check falhando) em evento; o relay já sabe quando o run termina.

## Progressão

- Prestígio no nível 50: reinicia o nível, mantém conquistas e ganha uma estrela ao lado do título (P)
- Títulos alternativos por estilo de uso (o "Madrugador de Terminal" para quem fecha turno de madrugada) (P)
- XP por turno proporcional à duração, com teto, em vez de valor fixo (P)
- Multiplicador de XP quando a sequência passa de 7 dias (P)
- "Dia de descanso" que protege a sequência uma vez por semana (P)
- Curva de nível ajustável por feature flag, para recalibrar sem perder progresso (P)
- Retrospectiva mensal: card com turnos, horas, sessões e conquistas, no estilo Wrapped (M)
- Barra de XP animada na sidebar que "enche" ao terminar um turno, respeitando reduced-motion (P)
- Histórico dos últimos 30 dias de XP em um gráfico pequeno na página do Arcade (M)

## Desafios semanais

- Meta semanal de turnos concluídos com recompensa maior que as missões diárias (P)
- "Semana sem erro de turno": nenhum `error` por 5 dias úteis (P)
- Desafio de variedade: usar 3 modelos diferentes na mesma semana (P)
- Desafio de limpeza: arquivar ou fechar 10 sessões paradas, ligado ao afunilamento da sidebar (M)
- Desafio de paralelismo: 3 agentes rodando ao mesmo tempo por 10 minutos, medido pelo `runningAnywhere` (M)
- Desafio de memória: salvar 3 notas na aba Memória (P)
- Quadro de desafios com rotação por temporada de 4 semanas (M)

## Boss fight de bug e CI

- Boss "CI Vermelho": check falhou, aparece um chefe com vida proporcional ao número de testes quebrados; cada commit verde tira vida (G)
- Boss "Merge Conflict" no Bit Runner, com um obstáculo grande que exige pulo duplo (P)
- Boss "Flaky Test": reaparece sempre que o mesmo teste falha duas vezes em runs diferentes (G)
- Barra de vida do boss no card da sessão do Canvas enquanto o agente corrige o bug (M)
- Derrota do boss dá loot garantido (ver "Loot de fim de PR") (P)
- Boss semanal "Dívida técnica": lista de TODOs do repo vira vida, um por PR de limpeza (G)

## Cosméticos e skins do Bit

- Chapéus e acessórios desbloqueados por nível ou conquista (cartola no nível 10, coroa no 50) (M)
- Skins de cor do corpo do Bit além do laranja (azul "modo Ocean", verde "modo Matrix") (P)
- Tela do Bit em tema alternativo: CRT âmbar, Game Boy, terminal verde (P)
- Estados novos do Bit: `proud` ao fechar a missão diária, `sweating` quando 3+ agentes rodam (P)
- Animação do Bit pulando junto com o cursor no Bit Runner (P)
- Bit pet na barra de status que anda de um lado para o outro quando o agente trabalha (M)
- Customização da antena (cor do LED muda com o nível de uso do plano) (P)
- Acessórios sazonais além de abóbora e gorro: fogos no Ano Novo, bolo no aniversário do Deck (P)

## Loot de fim de PR

- Caixa de loot ao detectar link de PR mergeado na conversa: XP extra e chance de cosmético (M)
- Raridade do loot pelo tamanho do PR e pelo tempo até o merge (M)
- Álbum de figurinhas: cada repositório em que o agente trabalhou vira uma figurinha colecionável (M)
- Loot por sequência de 5 turnos sem erro (P)
- Troca de loot repetido por "tokens do Bit", moeda para comprar cosméticos (M)
- Selo "PR de madrugada" no histórico de merges (P)

## Ranking com a Equipe e bots

- Placar semanal entre pessoas da Equipe, opt-in, só com XP e nível (G)
- Bots da Equipe jogando o Bit Runner com score simulado, como adversários fantasma (M)
- "Fantasma" da sua melhor corrida no Runner, desenhado em transparência (P)
- Duelo de Runner por link: mesma semente de obstáculos, quem fizer mais pontos vence (M)
- Mural de conquistas raras da Equipe com percentual de quem desbloqueou (G)
- Bots de agentes ganham XP próprio pelos turnos que concluem, aparecem no placar com ícone de robô (M)
- Troféu rotativo "Faxineiro da semana" para quem mais fechou sessões (P)

## Conquistas por dados reais do servidor

- "PR mergeado": 1, 10, 50 PRs, lendo o ledger de /pontos (M)
- "Economia de token": turno concluído abaixo de um custo mínimo, usando `costUsd` do `done` (P)
- "Cache feliz": turno com mais de 80% de leitura de cache (M)
- "Maratonista": sessão com mais de 2 horas de agente trabalhando (P)
- "Poliglota de modelo": turnos concluídos em 3 modelos distintos (P)
- "Dono do cron": criar e ver rodar 3 rotinas na aba Rotinas (M)
- "Skill author": publicar uma skill própria (M)
- "Time completo": ter agentes de 3 provedores conectados em Conexões (P)
- "Contexto sob controle": terminar turno com a janela de contexto abaixo de 50% após um handoff (M)

## Sons e temas

- Pacote de sons alternativo (Game Boy, arcade de fliperama, 16 bits) trocável em Configurações (M)
- Volume próprio do Arcade, separado do beep de fim de turno (P)
- Trilha de fundo chiptune opcional só dentro do Bit Runner (M)
- Som de "level up" diferente para cada faixa de título (P)
- Tema de cor sazonal na sidebar durante datas especiais (P)
- Modo CRT ajustável: intensidade das scanlines e curvatura (P)
- Tema "Terminal de verdade" do Deck inteiro como prêmio de nível 25 (G)

## Modos de trabalho

- Pomodoro de agentes: 25 minutos de foco em que o Deck só avisa turnos concluídos, com XP ao fim (M)
- Modo "Dia de deploy": checklist e contador de turnos até a produção, com selo ao final (M)
- Modo "Plantão": sequência de respostas rápidas em sessões em espera, medida pela fila "Aguardando você" (M)
- Modo "Caixa zerada": meta de zerar a fila Aguardando você, com confete ao chegar em zero (P)
- Temporizador de sprint no Canvas ligado ao kanban: cards movidos para Pronto dão XP (M)
- "Hora do Bit": lembrete amigável de pausa a cada 90 minutos de uso contínuo (P)

## Mini-jogos

- Bit Runner com tema de dia e noite que muda com o horário local (P)
- "Caça-bug": campo minado onde as minas são `TODO` e `FIXME` (M)
- "Tetris de commits": peças são diffs, linhas completas viram merge (G)
- "Digite o prompt": teste de velocidade de digitação com prompts reais da sua história (M)
- "Quem é o agente?": adivinhar qual modelo escreveu um trecho, com respostas do histórico (M)
- Snake do terminal com o Bit como cabeça e tokens como comida (P)
- Ranking local de recordes de todos os mini-jogos na página do Arcade (P)

## Easter eggs

- Digitar `sl` fora de campo faz um trem passar na tela (P)
- Digitar `rm -rf /` fora de campo mostra um susto falso com o Bit assustado (P)
- Konami no celular com gesto de arrastar em sequência (M)
- Bit responde "42" ao receber `the answer` na paleta (P)
- Aniversário do Deck com Bit de chapéu de festa e confete (P)
- Dia do Programador com mini-jogo especial de 256 segundos (M)
- Frase secreta no Docs que revela uma conquista escondida (P)
- Cutucar o Bit 100 vezes ao longo de uma semana desbloqueia um som de ronronar (P)
- Pi day (14/03) com Bit rodando em círculos e conquista "3,14" (P)
- Star Wars day (04/05) com texto rolando no estilo da abertura (P)

## Sincronização e infraestrutura

- Sincronizar estado do jogo via account-prefs com mesclagem por maior valor (maior XP, maior sequência, união das conquistas) (M)
- Exportar e importar progresso como arquivo JSON, para quem não usa conta (P)
- Reset de progresso com confirmação em Configurações (P)
- Telemetria local anônima de eventos do jogo só para calibrar o XP, nunca enviada (P)
- Evento `game_event` no relay para o servidor ser fonte da verdade dos contadores de turno (G)
- Detecção de farm: marcar e ignorar eventos em rajada vindos de scripts (P)
- Teste E2E de Playwright que joga o Bit Runner e confere o recorde persistido (M)
